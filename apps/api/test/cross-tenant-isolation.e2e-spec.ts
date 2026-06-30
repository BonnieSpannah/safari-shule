import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Cross-tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let alpha: SeededTenant;
  let beta: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    alpha = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'alpha');
    beta = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'beta');

    await runWithBypass(async () => {
      await prisma.student.create({
        data: {
          tenantId: alpha.tenantId,
          admissionNumber: 'ALPHA-001',
          legalName: 'Alpha Pupil',
          dateOfBirth: new Date('2015-01-15'),
          gender: 'male',
        },
      });
      await prisma.student.create({
        data: {
          tenantId: beta.tenantId,
          admissionNumber: 'BETA-001',
          legalName: 'Beta Pupil',
          dateOfBirth: new Date('2015-02-20'),
          gender: 'female',
        },
      });
    });
  });

  afterAll(async () => {
    await cleanupTenant(prisma, alpha.tenantId);
    await cleanupTenant(prisma, beta.tenantId);
    await app.close();
  });

  it('alpha admin lists only alpha students', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/students')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId);

    expect(res.status).toBe(200);
    const names = (res.body.data ?? []).map((s: { legalName: string }) => s.legalName);
    expect(names).toContain('Alpha Pupil');
    expect(names).not.toContain('Beta Pupil');
  });

  it('alpha admin cannot fetch beta students even with x-tenant-id spoof', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/students')
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', beta.tenantId);

    // JWT tid pins the request to alpha; spoofing x-tenant-id must not unlock beta data.
    const names = (res.body.data ?? []).map((s: { legalName: string }) => s.legalName);
    expect(names).not.toContain('Beta Pupil');
  });

  it('refusing a query without tenant context still happens at Prisma layer (runtime guard)', async () => {
    // Smoke: confirm the bypass-less prisma.scoped throws if no tenant.
    await expect(prisma.scoped.student.findMany({})).rejects.toThrow(/tenant context/i);
  });
});
