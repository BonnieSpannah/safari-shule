import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('RBAC permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'perms');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenant.tenantId);
    await app.close();
  });

  it('admin (school_manager) can create vehicles', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/vehicles')
      .set('Authorization', `Bearer ${tenant.adminAccessToken}`)
      .set('x-tenant-id', tenant.tenantId)
      .send({
        registration: 'KAA-PERM1',
        make: 'Toyota',
        model: 'Coaster',
        year: 2022,
        capacity: 33,
        ownership: 'school',
        status: 'active',
        odometerKm: 0,
      });
    expect([201, 200]).toContain(res.status);
  });

  it('driver cannot delete vehicles (403 Forbidden)', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/vehicles')
      .set('Authorization', `Bearer ${tenant.adminAccessToken}`)
      .set('x-tenant-id', tenant.tenantId)
      .send({
        registration: 'KAA-PERM2',
        make: 'Isuzu',
        model: 'NQR',
        year: 2021,
        capacity: 40,
        ownership: 'school',
        status: 'active',
        odometerKm: 0,
      });
    expect([201, 200]).toContain(created.status);
    const vehicleId = created.body.id;

    const res = await request(app.getHttpServer())
      .delete(`/v1/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
      .set('x-tenant-id', tenant.tenantId);
    expect(res.status).toBe(403);
  });

  it('driver can list vehicles (read permission granted)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/vehicles')
      .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
      .set('x-tenant-id', tenant.tenantId);
    expect(res.status).toBe(200);
  });
});
