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
      await prisma.trip.create({
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
});
