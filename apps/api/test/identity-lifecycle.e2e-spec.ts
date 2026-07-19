import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { bootstrapTestApp, cleanupTenant } from './helpers';

function sha256(v: string) {
  return createHash('sha256').update(v).digest('hex');
}

describe('Auth identity lifecycle — forgot/reset/activate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;

  const suffix = randomBytes(3).toString('hex');
  const slug = `lifecycle-${suffix}`;
  const adminEmail = `admin-${suffix}@lifecycle.test`;
  const adminPassword = 'First!Pass9x';

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    await tenantAdmin.createTenant({
      slug,
      subdomain: slug,
      name: 'Lifecycle School',
      contactEmail: adminEmail,
      planTier: 'pro',
      initialAdmin: {
        email: adminEmail,
        fullName: 'Lifecycle Admin',
        password: adminPassword,
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (tenant) await cleanupTenant(prisma, tenant.id);
    await app.close();
  });

  // ---------------------------------------------------------------------------
  //  Login lifecycle guards
  // ---------------------------------------------------------------------------

  it('login returns 200 for an active user', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', slug)
      .send({ email: adminEmail, password: adminPassword });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('login returns 401 with INVALID_CREDENTIALS for wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', slug)
      .send({ email: adminEmail, password: 'Wrong!Pass99' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('login returns 401 with USER_SUSPENDED for suspended user', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    const user = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    });
    await prisma.user.update({ where: { id: user.id }, data: { status: 'suspended' } });
    try {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('x-tenant-slug', slug)
        .send({ email: adminEmail, password: adminPassword });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('USER_SUSPENDED');
    } finally {
      await prisma.user.update({ where: { id: user.id }, data: { status: 'active' } });
    }
  });

  // ---------------------------------------------------------------------------
  //  Forgot password — never leaks user existence
  // ---------------------------------------------------------------------------

  it('POST /v1/auth/forgot-password returns 202 even for an unknown email', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ tenantSlug: slug, email: 'nobody@nowhere.test' });
    expect(res.status).toBe(202);
    expect(res.body.delivered).toBe(true);
  });

  it('forgot-password creates a PasswordResetToken for a valid user', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    // Remove any old tokens.
    await prisma.passwordResetToken.deleteMany({ where: { tenantId: tenant.id } });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ tenantSlug: slug, email: adminEmail });
    expect(res.status).toBe(202);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { tenantId: tenant.id, purpose: 'reset', usedAt: null },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  // ---------------------------------------------------------------------------
  //  Reset password — token validation + history check
  // ---------------------------------------------------------------------------

  it('POST /v1/auth/reset-password rejects a fake token', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({
        token: randomBytes(32).toString('hex'),
        newPassword: 'New!Pass9x99',
        confirmPassword: 'New!Pass9x99',
      });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('POST /v1/auth/reset-password with a valid token resets the password', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    const user = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    });

    // Issue a reset token directly via the service.
    const rawToken = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        tokenHash: sha256(rawToken),
        purpose: 'reset',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const newPw = 'Reset!Pass9x';
    const res = await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: newPw, confirmPassword: newPw });
    expect(res.status).toBe(200);
    expect(res.body.resetAt).toBeDefined();

    // Should be able to log in with new password immediately.
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', slug)
      .send({ email: adminEmail, password: newPw });
    expect(loginRes.status).toBe(200);

    // Old password should no longer work.
    const oldRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', slug)
      .send({ email: adminEmail, password: adminPassword });
    expect(oldRes.status).toBe(401);
  });

  it('POST /v1/auth/reset-password rejects a used (consumed) token', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    const user = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    });
    const rawToken = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        tokenHash: sha256(rawToken),
        purpose: 'reset',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: new Date(), // already consumed
      },
    });
    const res = await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'New!Pass9x99', confirmPassword: 'New!Pass9x99' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  // ---------------------------------------------------------------------------
  //  Activate — pending account sets password + goes active
  // ---------------------------------------------------------------------------

  it('POST /v1/auth/activate activates a pending user', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    const pendingPw = await auth.hashPassword('Pending!Pass1');
    const pendingEmail = `pending-${suffix}@lifecycle.test`;
    const pendingUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: pendingEmail,
        fullName: 'Pending User',
        passwordHash: pendingPw,
        status: 'pending',
        mustChangePassword: true,
      },
    });

    const rawToken = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        tenantId: tenant.id,
        userId: pendingUser.id,
        tokenHash: sha256(rawToken),
        purpose: 'activation',
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });

    const newPw = 'Active!Pass9x';
    const res = await request(app.getHttpServer())
      .post('/v1/auth/activate')
      .send({ token: rawToken, newPassword: newPw, confirmPassword: newPw });
    expect(res.status).toBe(200);
    expect(res.body.activatedAt).toBeDefined();

    // User is now active and can log in.
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-slug', slug)
      .send({ email: pendingEmail, password: newPw });
    expect(loginRes.status).toBe(200);

    // Confirm DB state.
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: pendingUser.id } });
    expect(updated.status).toBe('active');
    expect(updated.mustChangePassword).toBe(false);
    expect(updated.activatedAt).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  //  mustChangePassword — /v1/auth/me returns flag
  // ---------------------------------------------------------------------------

  it('GET /v1/auth/me includes mustChangePassword + passwordExpiresInDays', async () => {
    // Log in with the (now reset) admin.
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
    const user = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    });
    const tokens = await auth.issueTokenPair({
      id: user.id,
      tenantId: tenant.id,
      email: user.email,
      fullName: user.fullName,
    });

    const res = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .set('x-tenant-slug', slug);
    expect(res.status).toBe(200);
    expect(typeof res.body.mustChangePassword).toBe('boolean');
    expect(typeof res.body.passwordExpiresInDays).toBe('number');
    expect(res.body.preferences).toBeDefined();
  });
});
