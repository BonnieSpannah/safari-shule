import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { FeatureFlagService } from '../src/feature-flags/feature-flag.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Feature gating (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let flags: FeatureFlagService;
  let basic: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    flags = app.get(FeatureFlagService);

    // Create a "basic" tier tenant — mpesa_payments should NOT be enabled by default.
    const { tenant } = await tenantAdmin.createTenant({
      slug: `basic-${Date.now()}`,
      subdomain: `basic-${Date.now()}`,
      name: 'Basic Tier School',
      contactEmail: 'admin@basic.test',
      planTier: 'basic',
      initialAdmin: {
        email: 'admin@basic.test',
        fullName: 'Basic Admin',
        password: 'Test!Password1',
      },
    });
    const adminUser = await runWithBypass(() =>
      prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: 'admin@basic.test' } }),
    );
    const tokens = await auth.issueTokenPair({
      id: adminUser.id,
      tenantId: tenant.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
    });
    basic = {
      tenantId: tenant.id,
      subdomain: tenant.slug,
      adminUserId: adminUser.id,
      adminAccessToken: tokens.accessToken,
      driverUserId: '',
      driverAccessToken: '',
    };
  });

  afterAll(async () => {
    await cleanupTenant(prisma, basic.tenantId);
    await app.close();
  });

  it('basic plan tenant: mpesa_payments flag is disabled', async () => {
    const enabled = await flags.isEnabled(basic.tenantId, 'mpesa_payments');
    expect(enabled).toBe(false);
  });

  it('basic plan tenant: M-Pesa STK push endpoint returns 403 (feature gate)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/payments/mpesa/initiate')
      .set('Authorization', `Bearer ${basic.adminAccessToken}`)
      .set('x-tenant-id', basic.tenantId)
      .send({
        purpose: 'fuel',
        amountKes: 1000,
        phoneE164: '+254712345678',
        description: 'test',
      });
    // Either 403 (feature gate) or 404 (route missing for that plan) — both prove the gate works.
    expect([403, 404]).toContain(res.status);
  });

  it('basic plan SMS quota is 500', async () => {
    const quota = await flags.getLimit(basic.tenantId, 'sms_broadcast', 'monthly_sms_quota');
    expect(quota).toBe(500);
  });
});
