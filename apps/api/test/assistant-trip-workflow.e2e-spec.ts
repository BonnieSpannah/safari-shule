import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Assistant trip workflows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;

  let assignedTripId: string;
  let unassignedTripId: string;
  let admissionNumber: string;

  const authAs = (token: string) => ({ Authorization: `Bearer ${token}`, 'x-tenant-id': tenant.tenantId });

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'assist', {
      withDevice: true,
      withAssistant: true,
    });

    await runWithBypass(async () => {
      const routeId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO routes (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
        VALUES (
          ${routeId}::uuid, ${tenant.tenantId}::uuid, 'Assistant Route', 'assistant test route', true,
          ST_SetSRID(ST_MakePoint(36.8219, -1.2864), 4326)::geography,
          ST_SetSRID(ST_MakePoint(36.83, -1.30), 4326)::geography,
          NOW(), NOW()
        )
      `;

      const assigned = await prisma.trip.create({
        data: {
          tenantId: tenant.tenantId,
          routeId,
          vehicleId: tenant.device!.vehicleId,
          driverUserId: tenant.driverUserId,
          assistantUserId: tenant.assistant!.userId,
          scheduledStart: new Date(),
          direction: 'morning_pickup',
          status: 'in_progress',
          startedAt: new Date(),
        },
      });
      assignedTripId = assigned.id;

      const unassigned = await prisma.trip.create({
        data: {
          tenantId: tenant.tenantId,
          routeId,
          vehicleId: tenant.device!.vehicleId,
          driverUserId: tenant.driverUserId,
          scheduledStart: new Date(Date.now() + 3_600_000),
          direction: 'evening_dropoff',
        },
      });
      unassignedTripId = unassigned.id;

      admissionNumber = `ADM-${randomUUID().slice(0, 6)}`;
      const student = await prisma.student.create({
        data: {
          tenantId: tenant.tenantId,
          admissionNumber,
          legalName: 'Assistant Test Student',
          dateOfBirth: new Date('2015-04-01'),
          gender: 'female',
        },
      });
      await prisma.tripPassenger.create({
        data: {
          tenantId: tenant.tenantId,
          tripId: assigned.id,
          studentId: student.id,
          expected: true,
        },
      });
    });
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenant.tenantId);
    await app.close();
  });

  it('assistant can board a student on the trip they are assigned to', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${assignedTripId}/board`)
      .set(authAs(tenant.assistant!.accessToken))
      .send({ admissionNumber });

    expect([200, 201]).toContain(res.status);
    expect(res.body.boardedAt).toBeDefined();
  });

  it('assistant can alight a student on the trip they are assigned to', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${assignedTripId}/alight`)
      .set(authAs(tenant.assistant!.accessToken))
      .send({ admissionNumber });

    expect([200, 201]).toContain(res.status);
    expect(res.body.alightedAt).toBeDefined();
  });

  it('assistant gets 404 boarding on a trip they are not assigned to', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${unassignedTripId}/board`)
      .set(authAs(tenant.assistant!.accessToken))
      .send({ admissionNumber });

    expect(res.status).toBe(404);
  });

  it('driver board/alight on their own trip is unaffected', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${unassignedTripId}/board`)
      .set(authAs(tenant.driverAccessToken))
      .send({ admissionNumber });

    // The student is a passenger of the assigned trip only, so the driver's
    // own trip resolves but the passenger lookup does not.
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_ON_TRIP');
  });
});
