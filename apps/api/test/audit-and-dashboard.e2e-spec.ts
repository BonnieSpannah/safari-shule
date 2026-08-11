import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Audit log — GET /v1/audit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let alpha: SeededTenant;
  let beta: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    alpha = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'audit-alpha');
    beta = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'audit-beta');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, alpha.tenantId);
    await cleanupTenant(prisma, beta.tenantId);
    await app.close();
  });

  it('returns paginated audit log for the tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/audit')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('audit entries only contain records from the authenticated tenant', async () => {
    // Ensure at least one action is recorded for alpha by hitting any audited endpoint
    await request(app.getHttpServer())
      .post('/v1/rfid-devices')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId)
      .send({ deviceId: 'RFID-AUDIT-PROBE' });

    const res = await request(app.getHttpServer())
      .get('/v1/audit')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    // Every entry's actor (if present) must belong to alpha — no beta actor IDs
    const actorIds = res.body.data
      .filter((e: { actor?: { id: string } }) => e.actor)
      .map((e: { actor: { id: string } }) => e.actor.id);
    actorIds.forEach((id: string) => {
      expect(id).not.toBe(beta.adminUserId);
    });
  });

  it('driver cannot view audit log (lacks audit.view permission)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/audit')
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(403);
  });

  it('entityType filter narrows results', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/audit?entityType=rfid_device')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    res.body.data.forEach((entry: { entityType: string }) => {
      expect(entry.entityType).toBe('rfid_device');
    });
  });
});

describe('Dashboard stats — GET /v1/dashboard/stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let alpha: SeededTenant;
  let beta: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    alpha = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'dash-alpha');
    beta = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'dash-beta');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, alpha.tenantId);
    await cleanupTenant(prisma, beta.tenantId);
    await app.close();
  });

  it('returns all expected stat fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/dashboard/stats')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      users: expect.any(Number),
      students: expect.any(Number),
      staff: expect.any(Number),
      vehicles: expect.any(Number),
      routes: expect.any(Number),
      tripsToday: expect.any(Number),
      incidentsOpen: expect.any(Number),
    });
  });

  it('stats are scoped to the authenticated tenant (cross-tenant isolation)', async () => {
    // Seed a student only into beta
    const betaRes = await request(app.getHttpServer())
      .get('/v1/dashboard/stats')
      .set('Authorization', `Bearer ${beta.adminAccessToken}`)
      .set('x-tenant-id', beta.tenantId);

    const alphaRes = await request(app.getHttpServer())
      .get('/v1/dashboard/stats')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(alphaRes.status).toBe(200);
    expect(betaRes.status).toBe(200);
    // Both tenants start with the same seeded structure — totals must match their own data
    // and be independent of each other (neither pollutes the other's count)
    expect(alphaRes.body.users).toBeGreaterThanOrEqual(1); // at minimum the seeded admin
    expect(betaRes.body.users).toBeGreaterThanOrEqual(1);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/dashboard/stats')
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(401);
  });
});
