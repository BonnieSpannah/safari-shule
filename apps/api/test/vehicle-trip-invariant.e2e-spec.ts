import { INestApplication } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Vehicle one-active-trip invariant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let alpha: SeededTenant;
  let alphaRouteId: string;
  let otherDriverUserId: string;
  let thirdDriverUserId: string;
  let vehicleBId: string;
  let vehicleCId: string;
  let busyTripId: string;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    alpha = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'vti-alpha', { withDevice: true });
    const suffix = randomBytes(3).toString('hex');

    await runWithBypass(async () => {
      alphaRouteId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO routes (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
        VALUES (
          ${alphaRouteId}::uuid, ${alpha.tenantId}::uuid, 'Alpha Route', 'vehicle invariant test route', true,
          ST_SetSRID(ST_MakePoint(36.8219, -1.2864), 4326)::geography,
          ST_SetSRID(ST_MakePoint(36.83, -1.30), 4326)::geography,
          NOW(), NOW()
        );
      `;

      const driverRole = await prisma.role.findUniqueOrThrow({
        where: { tenantId_key: { tenantId: alpha.tenantId, key: 'driver' } },
      });

      const otherDriverPasswordHash = await auth.hashPassword('Driver2!Pass1');
      const otherDriver = await prisma.user.create({
        data: {
          tenantId: alpha.tenantId,
          email: `driver2-${suffix}@vti-alpha.test`,
          passwordHash: otherDriverPasswordHash,
          status: 'active',
          fullName: 'Second Driver',
        },
      });
      await prisma.userRole.create({
        data: { tenantId: alpha.tenantId, userId: otherDriver.id, roleId: driverRole.id },
      });
      otherDriverUserId = otherDriver.id;

      const thirdDriverPasswordHash = await auth.hashPassword('Driver3!Pass1');
      const thirdDriver = await prisma.user.create({
        data: {
          tenantId: alpha.tenantId,
          email: `driver3-${suffix}@vti-alpha.test`,
          passwordHash: thirdDriverPasswordHash,
          status: 'active',
          fullName: 'Third Driver',
        },
      });
      await prisma.userRole.create({
        data: { tenantId: alpha.tenantId, userId: thirdDriver.id, roleId: driverRole.id },
      });
      thirdDriverUserId = thirdDriver.id;

      const vehicleB = await prisma.vehicle.create({
        data: {
          tenantId: alpha.tenantId,
          registration: `KBB-${randomBytes(2).toString('hex').toUpperCase()}`,
          make: 'Toyota',
          model: 'Hiace',
          year: 2021,
          capacity: 25,
          ownership: 'school',
          status: 'active',
          odometerKm: 0,
        },
      });
      vehicleBId = vehicleB.id;

      const vehicleC = await prisma.vehicle.create({
        data: {
          tenantId: alpha.tenantId,
          registration: `KCC-${randomBytes(2).toString('hex').toUpperCase()}`,
          make: 'Toyota',
          model: 'Hiace',
          year: 2021,
          capacity: 25,
          ownership: 'school',
          status: 'active',
          odometerKm: 0,
        },
      });
      vehicleCId = vehicleC.id;

      // vehicleB is already "busy" with an in-progress trip driven by the third driver.
      const busyTrip = await prisma.trip.create({
        data: {
          tenantId: alpha.tenantId,
          routeId: alphaRouteId,
          vehicleId: vehicleBId,
          driverUserId: thirdDriverUserId,
          scheduledStart: new Date(),
          direction: 'morning_pickup',
          status: 'in_progress',
          startedAt: new Date(),
        },
      });
      busyTripId = busyTrip.id;
    });
  });

  afterAll(async () => {
    await cleanupTenant(prisma, alpha.tenantId);
    await app.close();
  });

  it('starting a trip fails with 409 TRIP_ALREADY_ACTIVE when the vehicle already has an active trip with a different driver', async () => {
    const firstTrip = await prisma.trip.create({
      data: {
        tenantId: alpha.tenantId,
        routeId: alphaRouteId,
        vehicleId: alpha.device!.vehicleId,
        driverUserId: otherDriverUserId,
        scheduledStart: new Date(),
        direction: 'morning_pickup',
        status: 'scheduled',
      },
    });

    await request(app.getHttpServer())
      .post(`/v1/trips/${firstTrip.id}/start`)
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId)
      .expect(201);

    const secondTrip = await prisma.trip.create({
      data: {
        tenantId: alpha.tenantId,
        routeId: alphaRouteId,
        vehicleId: alpha.device!.vehicleId, // same vehicle, different driver
        driverUserId: alpha.driverUserId,
        scheduledStart: new Date(),
        direction: 'evening_dropoff',
        status: 'scheduled',
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/v1/trips/${secondTrip.id}/start`)
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId)
      .expect(409);

    expect(res.body.code).toBe('TRIP_ALREADY_ACTIVE');
    expect(res.body.details.activeTripId).toBe(firstTrip.id);
    expect(res.body.message).toBe('Vehicle already has a trip in progress.');
    expect(res.body.details.conflictType).toBe('vehicle');
  });

  it('reassigning a scheduled trip vehicle to one that is already busy elsewhere is NOT blocked', async () => {
    const scheduledTrip = await prisma.trip.create({
      data: {
        tenantId: alpha.tenantId,
        routeId: alphaRouteId,
        vehicleId: vehicleCId,
        driverUserId: alpha.driverUserId,
        scheduledStart: new Date(),
        direction: 'morning_pickup',
        status: 'scheduled',
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/v1/trips/${scheduledTrip.id}/assignment`)
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId)
      .send({ vehicleId: vehicleBId });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'scheduled', vehicleId: vehicleBId });
  });

  it('reassigning an in-progress trip vehicle to one that is already busy elsewhere IS blocked', async () => {
    const inProgressTrip = await prisma.trip.create({
      data: {
        tenantId: alpha.tenantId,
        routeId: alphaRouteId,
        vehicleId: vehicleCId,
        driverUserId: alpha.driverUserId,
        scheduledStart: new Date(),
        direction: 'morning_pickup',
        status: 'in_progress',
        startedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/v1/trips/${inProgressTrip.id}/assignment`)
      .set('Authorization', `Bearer ${alpha.adminAccessToken}`)
      .set('x-tenant-id', alpha.tenantId)
      .send({ vehicleId: vehicleBId, reason: 'Vehicle breakdown mid-route.' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRIP_ALREADY_ACTIVE');
    expect(res.body.details.activeTripId).toBe(busyTripId);
    expect(res.body.message).toBe('Vehicle already has a trip in progress.');
    expect(res.body.details.conflictType).toBe('vehicle');
  });
});
