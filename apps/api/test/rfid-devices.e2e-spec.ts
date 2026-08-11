import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant, buildHardwareHeaders } from './helpers';

describe('RFID Device management — /v1/rfid-devices (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let alpha: SeededTenant;
  let beta: SeededTenant;
  let registeredDeviceId: string; // DB id of device registered in alpha

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    alpha = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'dev-alpha');
    beta = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'dev-beta');
  });

  afterAll(async () => {
    await cleanupTenant(prisma, alpha.tenantId);
    await cleanupTenant(prisma, beta.tenantId);
    await app.close();
  });

  describe('POST /v1/rfid-devices — register', () => {
    it('admin can register a new device and receives plain credentials once', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/rfid-devices')
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ deviceId: 'RFID-E2E-001' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('deviceId', 'RFID-E2E-001');
      expect(res.body).toHaveProperty('apiKey');
      expect(res.body).toHaveProperty('hmacSecret');
      expect(res.body.apiKey.length).toBeGreaterThanOrEqual(32);
      expect(res.body.hmacSecret.length).toBeGreaterThanOrEqual(32);
    });

    it('driver cannot register a device (lacks rfid_devices.manage)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/rfid-devices')
        .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ deviceId: 'RFID-E2E-DRIVER' });

      expect(res.status).toBe(403);
    });

    it('two registrations yield different credentials', async () => {
      const r1 = await request(app.getHttpServer())
        .post('/v1/rfid-devices')
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ deviceId: 'RFID-E2E-002' });
      const r2 = await request(app.getHttpServer())
        .post('/v1/rfid-devices')
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ deviceId: 'RFID-E2E-003' });

      expect(r1.body.apiKey).not.toBe(r2.body.apiKey);
      expect(r1.body.hmacSecret).not.toBe(r2.body.hmacSecret);
    });
  });

  describe('GET /v1/rfid-devices — list', () => {
    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/rfid-devices')
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ deviceId: 'RFID-E2E-LIST-001' });
      registeredDeviceId = res.body.deviceId; // hardware deviceId string
    });

    it('returns paginated list of devices for the tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/rfid-devices')
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('cross-tenant: alpha devices not visible to beta admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/rfid-devices')
        .set('Authorization', `Bearer ${beta.adminAccessToken}`)
        .set('x-tenant-id', beta.tenantId);

      expect(res.status).toBe(200);
      const ids: string[] = res.body.data.map((d: { deviceId: string }) => d.deviceId);
      expect(ids).not.toContain('RFID-E2E-LIST-001');
    });

    it('driver cannot list devices (lacks rfid_devices.view)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/rfid-devices')
        .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /v1/rfid-devices/:id/status', () => {
    let deviceDbId: string;

    beforeAll(async () => {
      // Register then immediately look up the DB id
      await request(app.getHttpServer())
        .post('/v1/rfid-devices')
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ deviceId: 'RFID-E2E-STATUS' });

      const list = await request(app.getHttpServer())
        .get('/v1/rfid-devices?q=RFID-E2E-STATUS')
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId);
      deviceDbId = list.body.data[0]?.id;
    });

    it('admin can disable a device', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/rfid-devices/${deviceDbId}/status`)
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ status: 'disabled' });

      expect(res.status).toBe(200);
    });

    it('admin can re-enable a disabled device', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/rfid-devices/${deviceDbId}/status`)
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
    });

    it('invalid status value is rejected', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/rfid-devices/${deviceDbId}/status`)
        .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .send({ status: 'broken' });

      expect(res.status).toBe(400);
    });
  });
});
