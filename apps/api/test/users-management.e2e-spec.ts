import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Users management — GET /v1/users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let alpha: SeededTenant;
  let beta: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    alpha = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'users-alpha');
    beta = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'users-beta');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, alpha.tenantId);
    await cleanupTenant(prisma, beta.tenantId);
    await app.close();
  });

  it('returns paginated users for the authenticated tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: expect.any(Number), total: expect.any(Number) });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('response users belong to the authenticated tenant only (cross-tenant isolation)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(alpha.adminUserId);
    expect(ids).not.toContain(beta.adminUserId);
  });

  it('spoofing x-tenant-id does not leak beta users to alpha token', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', beta.tenantId);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(beta.adminUserId);
  });

  it('driver role is forbidden (lacks roles.view permission)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(403);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users')
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(401);
  });

  it('search param (q) filters by name/email', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users?q=admin')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    const emails: string[] = res.body.data.map((u: { email: string }) => u.email);
    emails.forEach((e) => expect(e.toLowerCase()).toContain('admin'));
  });

  it('pagination: page=1 and page=9999 return consistent meta', async () => {
    const p1 = await request(app.getHttpServer())
      .get('/v1/users?page=1&pageSize=1')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    const p2 = await request(app.getHttpServer())
      .get('/v1/users?page=9999&pageSize=1')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(p1.status).toBe(200);
    expect(p2.status).toBe(200);
    // Total must be the same regardless of page
    expect(p1.body.meta.total).toBe(p2.body.meta.total);
    // Page 9999 should return empty data
    expect(p2.body.data).toHaveLength(0);
  });
});
