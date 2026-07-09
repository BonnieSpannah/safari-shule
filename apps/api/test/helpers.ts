/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { encryptSecret, sha256 } from '../src/common/crypto/secret-encryption';
import { RedisIoAdapter } from '../src/common/realtime/redis-io.adapter';

export interface SeededTenant {
  tenantId: string;
  subdomain: string;
  adminUserId: string;
  adminAccessToken: string;
  driverUserId: string;
  driverAccessToken: string;
  device?: { id: string; deviceId: string; apiKey: string; hmacSecret: string; vehicleId: string };
}

export async function bootstrapTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  tenantAdmin: TenantAdminService;
  auth: AuthService;
}> {
  process.env.NODE_ENV ??= 'test';
  process.env.INTEGRATIONS_MODE = 'mock';
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-test';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret-te';
  process.env.DATA_ENCRYPTION_KEY ??= 'test-data-encryption-key-please-32-bytes';

  const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);
  await app.init();

  const prisma = app.get(PrismaService);
  const tenantAdmin = app.get(TenantAdminService);
  const auth = app.get(AuthService);
  return { app, prisma, tenantAdmin, auth };
}

export async function seedTenantWithRoles(
  prisma: PrismaService,
  tenantAdmin: TenantAdminService,
  auth: AuthService,
  prefix: string,
  opts: { withDevice?: boolean } = {},
): Promise<SeededTenant> {
  const slug = `${prefix}-${randomBytes(3).toString('hex')}`;
  const { tenant } = await tenantAdmin.createTenant({
    slug,
    subdomain: slug,
    name: `${prefix} School`,
    contactEmail: `admin@${slug}.test`,
    planTier: 'pro',
    initialAdmin: {
      email: `admin@${slug}.test`,
      fullName: 'Test Admin',
      password: 'Test!Password1',
    },
  });

  return runWithBypass(async () => {
    const adminUser = await prisma.user.findFirstOrThrow({
      where: { tenantId: tenant.id, email: `admin@${slug}.test` },
    });
    const driverRole = await prisma.role.findUniqueOrThrow({
      where: { tenantId_key: { tenantId: tenant.id, key: 'driver' } },
    });
    const driverPassword = await auth.hashPassword('Driver!Pass1');
    const driver = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `driver@${slug}.test`,
        passwordHash: driverPassword,
        status: 'active',
        fullName: 'Test Driver',
      },
    });
    await prisma.userRole.create({
      data: { tenantId: tenant.id, userId: driver.id, roleId: driverRole.id },
    });

    const adminTokens = await auth.issueTokenPair({
      id: adminUser.id,
      tenantId: tenant.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
    });
    const driverTokens = await auth.issueTokenPair({
      id: driver.id,
      tenantId: tenant.id,
      email: driver.email,
      fullName: driver.fullName,
    });

    let device: SeededTenant['device'];
    if (opts.withDevice) {
      const vehicle = await prisma.vehicle.create({
        data: {
          tenantId: tenant.id,
          registration: `KAA-${randomBytes(2).toString('hex').toUpperCase()}`,
          make: 'Toyota',
          model: 'Coaster',
          year: 2020,
          capacity: 33,
          ownership: 'school',
          status: 'active',
          odometerKm: 0,
        },
      });
      const apiKey = randomBytes(16).toString('hex');
      const hmacSecret = randomBytes(32).toString('hex');
      const deviceIdStr = `RFID-${randomBytes(3).toString('hex').toUpperCase()}`;
      const created = await prisma.rfidDevice.create({
        data: {
          tenantId: tenant.id,
          deviceId: deviceIdStr,
          vehicleId: vehicle.id,
          apiKeyHash: sha256(apiKey),
          hmacSecretEncrypted: encryptSecret(hmacSecret),
          status: 'active',
        },
      });
      device = { id: created.id, deviceId: deviceIdStr, apiKey, hmacSecret, vehicleId: vehicle.id };
    }

    return {
      tenantId: tenant.id,
      subdomain: slug,
      adminUserId: adminUser.id,
      adminAccessToken: adminTokens.accessToken,
      driverUserId: driver.id,
      driverAccessToken: driverTokens.accessToken,
      device,
    } satisfies SeededTenant;
  });
}

export function buildHardwareHeaders(opts: {
  deviceId: string;
  apiKey: string;
  hmacSecret: string;
  rawBody: string;
  timestamp?: number;
}): Record<string, string> {
  // The guard compares timestamp to Date.now() in milliseconds with a ±5min window.
  const ts = String(opts.timestamp ?? Date.now());
  const signature = createHmac('sha256', opts.hmacSecret)
    .update(`${opts.deviceId}.${ts}.${opts.rawBody}`)
    .digest('hex');
  return {
    'x-device-id': opts.deviceId,
    'x-api-key': opts.apiKey,
    'x-timestamp': ts,
    'x-signature': signature,
    'content-type': 'application/json',
  };
}

export async function cleanupTenant(prisma: PrismaService, tenantId: string): Promise<void> {
  await runWithBypass(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
  });
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}
