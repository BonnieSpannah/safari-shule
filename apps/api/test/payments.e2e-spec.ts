import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Payments read APIs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;
  let txnId: string;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'payments-read');

    const txn = await runWithBypass(() =>
      prisma.mpesaTransaction.create({
        data: {
          tenantId: tenant.tenantId,
          purpose: 'fuel',
          amountKes: 2300,
          phoneE164: '+254712345678',
          accountReference: 'fuel-log-seed',
          checkoutRequestId: `ws_CO_${Date.now()}`,
          merchantRequestId: `ws_MR_${Date.now()}`,
          status: 'succeeded',
          resultCode: 0,
          resultDescription: 'The service request is processed successfully.',
          mpesaReceiptNumber: 'QWE123ABC',
          completedAt: new Date(),
        },
      }),
    );
    txnId = txn.id;
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenant.tenantId);
    await app.close();
  });

  it('admin can list payment transactions for own tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/payments?page=1&pageSize=10&status=succeeded')
      .set('Authorization', `Bearer ${tenant.adminAccessToken}`)
      .set('x-tenant-id', tenant.tenantId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((t: { id: string }) => t.id === txnId)).toBe(true);
  });

  it('admin can fetch a single payment transaction by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/payments/${txnId}`)
      .set('Authorization', `Bearer ${tenant.adminAccessToken}`)
      .set('x-tenant-id', tenant.tenantId);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(txnId);
    expect(res.body.tenantId).toBe(tenant.tenantId);
    expect(res.body.status).toBe('succeeded');
  });

  it('driver cannot read payments (403)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/payments?page=1&pageSize=10')
      .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
      .set('x-tenant-id', tenant.tenantId);

    expect(res.status).toBe(403);
  });
});
