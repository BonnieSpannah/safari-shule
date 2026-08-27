import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Communications DNC suppression (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;
  let tripId: string;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'dnc-sos');

    await runWithBypass(async () => {
      const blockedPhone = '+254712999001';
      await prisma.incidentEmergencyContact.create({
        data: {
          tenantId: tenant.tenantId,
          name: 'Blocked Contact',
          role: 'headteacher',
          phoneE164: blockedPhone,
          priority: 1,
          isActive: true,
        },
      });
      await prisma.doNotContact.create({
        data: {
          tenantId: tenant.tenantId,
          channel: 'sms',
          destination: blockedPhone,
          reason: 'user_request',
        },
      });

      const vehicle = await prisma.vehicle.create({
        data: {
          tenantId: tenant.tenantId,
          registration: 'KCD 100X',
          make: 'Toyota',
          model: 'Coaster',
          year: 2021,
          capacity: 33,
          ownership: 'school',
          status: 'active',
          odometerKm: 0,
        },
      });

      const routeId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO routes (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
        VALUES (
          ${routeId}::uuid, ${tenant.tenantId}::uuid, 'DNC Route', 'dnc route', true,
          ST_SetSRID(ST_MakePoint(36.8219, -1.2864), 4326)::geography,
          ST_SetSRID(ST_MakePoint(36.83, -1.30), 4326)::geography,
          NOW(), NOW()
        );
      `;

      const trip = await prisma.trip.create({
        data: {
          tenantId: tenant.tenantId,
          routeId,
          vehicleId: vehicle.id,
          driverUserId: tenant.driverUserId,
          scheduledStart: new Date(),
          direction: 'morning_pickup',
          status: 'in_progress',
          startedAt: new Date(),
        },
      });
      tripId = trip.id;
    });
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenant.tenantId);
    await app.close();
  });

  it('suppresses SOS SMS sends for DNC destinations while keeping incident flow successful', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${tripId}/sos`)
      .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
      .set('x-tenant-id', tenant.tenantId)
      .send({
        description: 'DNC suppression test',
        location: { lat: -1.2864, lng: 36.8219 },
      });

    expect([200, 201, 202]).toContain(res.status);
    expect(res.body?.incident?.ok).toBe(true);

    const msg = await runWithBypass(() =>
      prisma.outboundMessage.findFirst({
        where: {
          tenantId: tenant.tenantId,
          to: '+254712999001',
          templateId: 'sos.alert',
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    expect(msg).toBeTruthy();
    expect(msg?.status).toBe('failed');
    expect(msg?.error).toContain('Suppressed by do-not-contact policy');
  });
});
