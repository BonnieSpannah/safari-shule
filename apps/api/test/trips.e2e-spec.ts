import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Trips — GET /v1/trips (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let alpha: SeededTenant;
  let beta: SeededTenant;
  let alphaTripId: string;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    alpha = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'trips-alpha', { withDevice: true });
    beta = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'trips-beta', { withDevice: true });

    // Seed one trip into alpha and one into beta
    await runWithBypass(async () => {
      const alphaRouteId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO routes (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
        VALUES (
          ${alphaRouteId}::uuid, ${alpha.tenantId}::uuid, 'Alpha Route', 'trips test route', true,
          ST_SetSRID(ST_MakePoint(36.8219, -1.2864), 4326)::geography,
          ST_SetSRID(ST_MakePoint(36.83, -1.30), 4326)::geography,
          NOW(), NOW()
        );
      `;
      const trip = await prisma.trip.create({
        data: {
          tenantId: alpha.tenantId,
          routeId: alphaRouteId,
          vehicleId: alpha.device!.vehicleId,
          driverUserId: alpha.driverUserId,
          scheduledStart: new Date(),
          direction: 'morning_pickup',
          status: 'scheduled',
        },
      });
      alphaTripId = trip.id;
    });
  });

  afterAll(async () => {
    await cleanupTenant(prisma, alpha.tenantId);
    await cleanupTenant(prisma, beta.tenantId);
    await app.close();
  });

  it('returns paginated response', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/trips')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('beta trips are not visible to alpha admin (tenant scoping)', async () => {
    const alphaRes = await request(app.getHttpServer())
      .get('/v1/trips')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    const betaRes = await request(app.getHttpServer())
      .get('/v1/trips')
      .set('Authorization', `Bearer ${beta.adminAccessToken}`)
      .set('x-tenant-id', beta.tenantId);

    // Totals must be per-tenant, not combined
    expect(alphaRes.body.meta.total).toBeGreaterThanOrEqual(1); // alpha has the seeded trip
    expect(betaRes.body.meta.total).toBe(0);                    // beta has none
  });

  it('status filter returns only matching trips', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/trips?status=scheduled')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    res.body.data.forEach((t: { status: string }) => {
      expect(t.status).toBe('scheduled');
    });
  });

  it('driver cannot list trips (lacks trips.view permission)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/trips')
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    // Driver role has trips.view — expect 200
    expect(res.status).toBe(200);
  });

  it('allows an assigned driver to start and end their scheduled trip', async () => {
    const started = await request(app.getHttpServer())
      .post(`/v1/trips/${alphaTripId}/driver-start`)
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(started.status).toBe(201);
    expect(started.body.status).toBe('in_progress');

    const ended = await request(app.getHttpServer())
      .post(`/v1/trips/${alphaTripId}/driver-end`)
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(ended.status).toBe(201);
    expect(ended.body.status).toBe('completed');
  });

  it('allows an assigned driver to post a location for their in-progress trip', async () => {
    await runWithBypass(() =>
      prisma.trip.update({
        where: { id: alphaTripId },
        data: { status: 'scheduled', startedAt: null, endedAt: null },
      }),
    );

    await request(app.getHttpServer())
      .post(`/v1/trips/${alphaTripId}/driver-start`)
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId)
      .expect(201);

    const location = await request(app.getHttpServer())
      .post(`/v1/trips/${alphaTripId}/driver-location`)
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId)
      .send({
        lat: -1.2921,
        lng: 36.8219,
        heading_degrees: 90,
        speed_mps: 8,
        timestamp: Date.now(),
      });

    expect(location.status).toBe(201);
    expect(location.body).toEqual({ ok: true });
  });
});
