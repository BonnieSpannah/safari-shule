import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('SOS incident flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;
  let tripId: string;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'sos');

    await runWithBypass(async () => {
      await prisma.incidentEmergencyContact.create({
        data: {
          tenantId: tenant.tenantId,
          name: 'Headteacher',
          role: 'headteacher',
          phoneE164: '+254712999000',
          priority: 1,
        },
      });

      const vehicle = await prisma.vehicle.create({
        data: {
          tenantId: tenant.tenantId,
          registration: 'KCB 909Z',
          make: 'Toyota',
          model: 'Coaster',
          year: 2022,
          capacity: 33,
          ownership: 'school',
          status: 'active',
          odometerKm: 0,
        },
      });

      const routeId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO routes (id, tenant_id, name, description, is_active, start_point, end_point, created_at, updated_at)
        VALUES (
          ${routeId}::uuid, ${tenant.tenantId}::uuid, 'SOS Route', 'sos test route', true,
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

  it('driver SOS returns 202 with per-leg statuses + persists an incident row', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${tripId}/sos`)
      .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
      .set('x-tenant-id', tenant.tenantId)
      .send({
        description: 'Vehicle stopped, hazard lights on, driver requesting help.',
        location: { lat: -1.2864, lng: 36.8219 },
      });

    expect([200, 201, 202]).toContain(res.status);
    expect(res.body).toHaveProperty('incident');
    expect(res.body).toHaveProperty('broadcast');
    expect(res.body).toHaveProperty('notifications');
    expect(res.body.incident).toHaveProperty('ok');

    const incidents = await runWithBypass(() =>
      prisma.incident.findMany({
        where: { tenantId: tenant.tenantId, kind: 'sos' },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      }),
    );
    expect(incidents.length).toBe(1);
    expect(incidents[0]!.severity).toBe('critical');
    expect(incidents[0]!.status).toBe('reported');
  });

  it('SOS without a registered emergency contact still persists the incident', async () => {
    await runWithBypass(() =>
      prisma.incidentEmergencyContact.deleteMany({ where: { tenantId: tenant.tenantId } }),
    );

    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${tripId}/sos`)
      .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
      .set('x-tenant-id', tenant.tenantId)
      .send({
        description: 'Test - no contacts',
        location: { lat: -1.2864, lng: 36.8219 },
      });

    expect([200, 201, 202]).toContain(res.status);
    expect(res.body?.incident?.ok).toBe(true);
  });
});
