import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Audit client events (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'audit-events');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenant.tenantId);
    await app.close();
  });

  it('accepts a client event batch from an authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/audit/events')
      .set('Authorization', `Bearer ${tenant.adminAccessToken}`)
      .set('x-tenant-id', tenant.tenantId)
      .send({
        events: [
          {
            kind: 'view',
            resource: 'payments',
            path: '/payments',
            payload: { source: 'e2e' },
          },
        ],
      });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);

    const stored = await runWithBypass(() =>
      prisma.clientEvent.findMany({
        where: { tenantId: tenant.tenantId, resource: 'payments' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    );
    expect(stored.length).toBe(1);
    expect(stored[0]?.kind).toBe('view');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app.getHttpServer()).post('/v1/audit/events').send({
      events: [{ kind: 'view' }],
    });
    expect(res.status).toBe(401);
  });
});
