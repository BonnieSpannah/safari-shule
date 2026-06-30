import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { bootstrapTestApp, buildHardwareHeaders, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Hardware HMAC auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'hw', { withDevice: true });
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenant.tenantId);
    await app.close();
  });

  it('rejects request missing all hardware headers (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/hardware/gps')
      .send({ device_id: tenant.device!.deviceId, lat: -1.28, lng: 36.82, timestamp: Date.now() });
    expect(res.status).toBe(401);
  });

  it('rejects request with bad signature (401)', async () => {
    const body = { device_id: tenant.device!.deviceId, lat: -1.28, lng: 36.82, timestamp: Date.now() };
    const headers = buildHardwareHeaders({
      deviceId: tenant.device!.deviceId,
      apiKey: tenant.device!.apiKey,
      hmacSecret: 'wrong-secret-wrong-secret-wrong-secret-32',
      rawBody: JSON.stringify(body),
    });
    const res = await request(app.getHttpServer())
      .post('/v1/hardware/gps')
      .set(headers)
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body?.code ?? res.body?.message?.code).toMatch(/BAD_SIGNATURE/i);
  });

  it('rejects replay outside the ±5min window (401)', async () => {
    const oldTimestamp = Date.now() - 10 * 60 * 1000;
    const body = { device_id: tenant.device!.deviceId, lat: -1.28, lng: 36.82, timestamp: oldTimestamp };
    const headers = buildHardwareHeaders({
      deviceId: tenant.device!.deviceId,
      apiKey: tenant.device!.apiKey,
      hmacSecret: tenant.device!.hmacSecret,
      rawBody: JSON.stringify(body),
      timestamp: oldTimestamp,
    });
    const res = await request(app.getHttpServer())
      .post('/v1/hardware/gps')
      .set(headers)
      .send(body);
    expect(res.status).toBe(401);
  });

  it('rejects request with wrong API key (401)', async () => {
    const body = { device_id: tenant.device!.deviceId, lat: -1.28, lng: 36.82, timestamp: Date.now() };
    const headers = buildHardwareHeaders({
      deviceId: tenant.device!.deviceId,
      apiKey: 'wrong-api-key',
      hmacSecret: tenant.device!.hmacSecret,
      rawBody: JSON.stringify(body),
    });
    const res = await request(app.getHttpServer())
      .post('/v1/hardware/gps')
      .set(headers)
      .send(body);
    expect(res.status).toBe(401);
  });

  it('accepts a valid signed GPS ping (200)', async () => {
    const body = { device_id: tenant.device!.deviceId, lat: -1.28, lng: 36.82, timestamp: Date.now() };
    const headers = buildHardwareHeaders({
      deviceId: tenant.device!.deviceId,
      apiKey: tenant.device!.apiKey,
      hmacSecret: tenant.device!.hmacSecret,
      rawBody: JSON.stringify(body),
    });
    const res = await request(app.getHttpServer())
      .post('/v1/hardware/gps')
      .set(headers)
      .send(body);
    expect([200, 201]).toContain(res.status);
  });
});
