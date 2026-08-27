import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { bootstrapTestApp, cleanupTenant } from './helpers';

describe('Bull Board access control (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;

  const suffix = randomBytes(3).toString('hex');
  const platformSlug = `queues-platform-${suffix}`;
  const superEmail = `super-${suffix}@safarishule.test`;
  const superPassword = 'Super!Test1';
  const schoolSlug = `queues-school-${suffix}`;
  const schoolAdminEmail = `admin-${suffix}@school.test`;
  const schoolAdminPassword = 'School!Admin1';

  const createdSlugs: string[] = [];

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin } = await bootstrapTestApp());

    await tenantAdmin.createTenant({
      slug: platformSlug,
      subdomain: platformSlug,
      name: 'Queues Platform',
      contactEmail: superEmail,
      planTier: 'enterprise',
      initialAdmin: {
        email: superEmail,
        fullName: 'Queues Super Admin',
        password: superPassword,
        roleKey: 'system_admin',
      },
    });
    createdSlugs.push(platformSlug);

    await tenantAdmin.createTenant({
      slug: schoolSlug,
      subdomain: schoolSlug,
      name: 'Queues School',
      contactEmail: schoolAdminEmail,
      planTier: 'pro',
      initialAdmin: {
        email: schoolAdminEmail,
        fullName: 'School Admin',
        password: schoolAdminPassword,
      },
    });
    createdSlugs.push(schoolSlug);
  });

  afterAll(async () => {
    for (const slug of createdSlugs) {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (tenant) await cleanupTenant(prisma, tenant.id);
    }
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app.getHttpServer()).get('/admin/queues');
    expect(res.status).toBe(401);
  });

  it('rejects authenticated non-super-admin users with 403', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', schoolSlug)
      .send({ email: schoolAdminEmail, password: schoolAdminPassword });
    expect(login.status).toBe(200);

    const res = await request(app.getHttpServer())
      .get('/admin/queues')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('allows super admins with tenants.manage permission', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', platformSlug)
      .send({ email: superEmail, password: superPassword });
    expect(login.status).toBe(200);

    const res = await request(app.getHttpServer())
      .get('/admin/queues')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] ?? '')).toContain('text/html');
  });
});
