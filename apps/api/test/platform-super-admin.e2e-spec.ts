import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { bootstrapTestApp, cleanupTenant } from './helpers';

describe('Platform super admin — tenant provisioning (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;

  const suffix = randomBytes(3).toString('hex');
  const platformSlug = `platform-${suffix}`;
  const superEmail = `super-${suffix}@safarishule.test`;
  const superPassword = 'Super!Test1';

  const createdTenantSlugs: string[] = [];

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());

    // Bootstrap the platform tenant with a super admin (roleKey: system_admin
    // grants every permission including tenants.manage).
    await tenantAdmin.createTenant({
      slug: platformSlug,
      subdomain: platformSlug,
      name: 'Test Platform',
      contactEmail: superEmail,
      planTier: 'enterprise',
      initialAdmin: {
        email: superEmail,
        fullName: 'Test Super Admin',
        password: superPassword,
        roleKey: 'system_admin',
      },
    });
    createdTenantSlugs.push(platformSlug);
  });

  afterAll(async () => {
    for (const slug of createdTenantSlugs) {
      const t = await prisma.tenant.findUnique({ where: { slug } });
      if (t) await cleanupTenant(prisma, t.id);
    }
    await app.close();
  });

  it('super admin logs in and receives tenants.manage in permissions', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', platformSlug)
      .send({ email: superEmail, password: superPassword });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // Permissions on the login payload's user (or fetched next)
    const permsRow = await prisma.$queryRaw<Array<{ key: string }>>`
      SELECT p."key" FROM permissions p
      JOIN role_permissions rp ON rp."permissionId" = p.id
      JOIN user_roles ur ON ur."roleId" = rp."roleId"
      JOIN users u ON u.id = ur."userId"
      WHERE u.email = ${superEmail}
    `;
    const permKeys = permsRow.map((r) => r.key);
    expect(permKeys).toContain('tenants.manage');
    expect(permKeys).toContain('tenants.create');
  });

  it('super admin can POST /v1/admin/tenants to create a new school tenant', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', platformSlug)
      .send({ email: superEmail, password: superPassword });
    const accessToken: string = loginRes.body.accessToken;

    const newSlug = `sunrise-${randomBytes(3).toString('hex')}`;
    const newAdminEmail = `admin-${suffix}@sunrise.test`;
    const newAdminPassword = 'Sunrise!Adm1';
    const createRes = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-slug', platformSlug)
      .send({
        slug: newSlug,
        subdomain: newSlug,
        name: 'Sunrise Academy',
        contactEmail: newAdminEmail,
        planTier: 'pro',
        initialAdmin: {
          email: newAdminEmail,
          fullName: 'Sunrise Admin',
          phone: '+254712000099',
          password: newAdminPassword,
        },
      });

    expect([200, 201]).toContain(createRes.status);
    expect(createRes.body.tenant?.slug).toBe(newSlug);
    expect(createRes.body.adminUser?.email).toBe(newAdminEmail);
    createdTenantSlugs.push(newSlug);

    // New tenant's admin should be able to log into their own tenant
    const newAdminLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', newSlug)
      .send({ email: newAdminEmail, password: newAdminPassword });
    expect(newAdminLogin.status).toBe(200);
    expect(newAdminLogin.body.accessToken).toBeDefined();

    // New admin (school_manager role) must NOT have tenants.manage
    const newAdminPerms = await prisma.$queryRaw<Array<{ key: string }>>`
      SELECT p."key" FROM permissions p
      JOIN role_permissions rp ON rp."permissionId" = p.id
      JOIN user_roles ur ON ur."roleId" = rp."roleId"
      JOIN users u ON u.id = ur."userId"
      WHERE u.email = ${newAdminEmail}
    `;
    const newAdminPermKeys = newAdminPerms.map((r) => r.key);
    expect(newAdminPermKeys).not.toContain('tenants.manage');
    expect(newAdminPermKeys).toContain('students.view');
  });

  it('new school admin gets 403 when trying to create another tenant', async () => {
    const targetSlug = createdTenantSlugs.find((s) => s.startsWith('sunrise-'))!;
    const targetAdminEmail = `admin-${suffix}@sunrise.test`;
    const targetAdminPassword = 'Sunrise!Adm1';
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', targetSlug)
      .send({ email: targetAdminEmail, password: targetAdminPassword });
    const accessToken: string = loginRes.body.accessToken;

    const attemptedSlug = `attempt-${randomBytes(3).toString('hex')}`;
    const res = await request(app.getHttpServer())
      .post('/v1/admin/tenants')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-slug', targetSlug)
      .send({
        slug: attemptedSlug,
        subdomain: attemptedSlug,
        name: 'Should Not Exist',
        contactEmail: 'noop@example.test',
        planTier: 'basic',
        initialAdmin: {
          email: 'noop@example.test',
          fullName: 'Ignored',
          password: 'Ignored!123',
        },
      });

    expect(res.status).toBe(403);
    // Confirm no row leaked into the DB
    const leaked = await prisma.tenant.findUnique({ where: { slug: attemptedSlug } });
    expect(leaked).toBeNull();
  });
});
