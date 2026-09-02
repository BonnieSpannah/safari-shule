import { INestApplication } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('Driver workspace (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let alpha: SeededTenant;
  let beta: SeededTenant;

  let activeTripId: string;
  let nextTripId: string;
  let laterTripId: string;
  let latestFinalTripId: string;
  let olderFinalTripId: string;
  let otherDriverTripId: string;
  let betaTripId: string;
  let secondDriverAccessToken: string;
  let assistantUserId: string;
  const assistantFullName = 'Trip Assistant';

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    alpha = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'dw-alpha', { withDevice: true });
    beta = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'dw-beta', { withDevice: true });
    const suffix = randomBytes(3).toString('hex');
    const now = Date.now();

    await runWithBypass(async () => {
      // ── Alpha route with one bus stop ────────────────────────────────────────
      const alphaRouteId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO routes (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
        VALUES (
          ${alphaRouteId}::uuid, ${alpha.tenantId}::uuid, 'Alpha Route', 'workspace test route', true,
          ST_SetSRID(ST_MakePoint(36.8219, -1.2864), 4326)::geography,
          ST_SetSRID(ST_MakePoint(36.83, -1.30), 4326)::geography,
          NOW(), NOW()
        )
      `;

      await prisma.$executeRaw`
        INSERT INTO bus_stops (id, "tenantId", "routeId", name, "pickupOrder", "scheduledPickupTime", "scheduledDropoffTime", location)
        VALUES (
          ${randomUUID()}::uuid, ${alpha.tenantId}::uuid, ${alphaRouteId}::uuid,
          'Junction A', 1, '07:00', '17:00',
          ST_SetSRID(ST_MakePoint(36.825, -1.29), 4326)::geography
        )
      `;

      // ── Second driver in alpha (for isolation and limit tests) ───────────────
      const driverRole = await prisma.role.findUniqueOrThrow({
        where: { tenantId_key: { tenantId: alpha.tenantId, key: 'driver' } },
      });
      const secondDriverPasswordHash = await auth.hashPassword('Driver2!Pass1');
      const secondDriver = await prisma.user.create({
        data: {
          tenantId: alpha.tenantId,
          email: `driver2-${suffix}@dw-alpha.test`,
          passwordHash: secondDriverPasswordHash,
          status: 'active',
          fullName: 'Second Driver',
        },
      });
      await prisma.userRole.create({
        data: { tenantId: alpha.tenantId, userId: secondDriver.id, roleId: driverRole.id },
      });
      const secondDriverTokens = await auth.issueTokenPair({
        id: secondDriver.id,
        tenantId: alpha.tenantId,
        email: secondDriver.email,
        fullName: secondDriver.fullName,
      });
      secondDriverAccessToken = secondDriverTokens.accessToken;

      // ── Assistant assigned to the active trip ────────────────────────────────
      const assistantRole = await prisma.role.findUniqueOrThrow({
        where: { tenantId_key: { tenantId: alpha.tenantId, key: 'assistant' } },
      });
      const assistantPasswordHash = await auth.hashPassword('Assistant!Pass1');
      const assistant = await prisma.user.create({
        data: {
          tenantId: alpha.tenantId,
          email: `assistant-${suffix}@dw-alpha.test`,
          passwordHash: assistantPasswordHash,
          status: 'active',
          fullName: assistantFullName,
        },
      });
      await prisma.userRole.create({
        data: { tenantId: alpha.tenantId, userId: assistant.id, roleId: assistantRole.id },
      });
      assistantUserId = assistant.id;

      // ── Students for passenger seeding ───────────────────────────────────────
      const student1 = await prisma.student.create({
        data: {
          tenantId: alpha.tenantId,
          admissionNumber: `STU-001-${suffix}`,
          legalName: 'Student One',
          dateOfBirth: new Date('2015-01-01'),
          gender: 'male',
        },
      });
      const student2 = await prisma.student.create({
        data: {
          tenantId: alpha.tenantId,
          admissionNumber: `STU-002-${suffix}`,
          legalName: 'Student Two',
          dateOfBirth: new Date('2015-02-01'),
          gender: 'female',
        },
      });

      // ── Trips for alpha.driverUserId ─────────────────────────────────────────
      const activeTrip = await prisma.trip.create({
        data: {
          tenantId: alpha.tenantId,
          routeId: alphaRouteId,
          vehicleId: alpha.device!.vehicleId,
          driverUserId: alpha.driverUserId,
          assistantUserId: assistant.id,
          scheduledStart: new Date(now - 1800_000),
          direction: 'morning_pickup',
          status: 'in_progress' as any,
          startedAt: new Date(now - 1800_000),
        },
      });
      activeTripId = activeTrip.id;

      const nextTrip = await prisma.trip.create({
        data: {
          tenantId: alpha.tenantId,
          routeId: alphaRouteId,
          vehicleId: alpha.device!.vehicleId,
          driverUserId: alpha.driverUserId,
          scheduledStart: new Date(now + 3600_000),
          direction: 'evening_dropoff',
          status: 'scheduled',
        },
      });
      nextTripId = nextTrip.id;

      const laterTrip = await prisma.trip.create({
        data: {
          tenantId: alpha.tenantId,
          routeId: alphaRouteId,
          vehicleId: alpha.device!.vehicleId,
          driverUserId: alpha.driverUserId,
          scheduledStart: new Date(now + 7200_000),
          direction: 'morning_pickup',
          status: 'scheduled',
        },
      });
      laterTripId = laterTrip.id;

      const latestFinalTrip = await prisma.trip.create({
        data: {
          tenantId: alpha.tenantId,
          routeId: alphaRouteId,
          vehicleId: alpha.device!.vehicleId,
          driverUserId: alpha.driverUserId,
          scheduledStart: new Date(now - 7200_000),
          direction: 'morning_pickup',
          status: 'completed' as any,
          startedAt: new Date(now - 7200_000),
          endedAt: new Date(now - 3600_000),
        },
      });
      latestFinalTripId = latestFinalTrip.id;

      const olderFinalTrip = await prisma.trip.create({
        data: {
          tenantId: alpha.tenantId,
          routeId: alphaRouteId,
          vehicleId: alpha.device!.vehicleId,
          driverUserId: alpha.driverUserId,
          scheduledStart: new Date(now - 14400_000),
          direction: 'morning_pickup',
          status: 'completed' as any,
          startedAt: new Date(now - 14400_000),
          endedAt: new Date(now - 10800_000),
        },
      });
      olderFinalTripId = olderFinalTrip.id;

      // ── Other driver's trip in alpha ─────────────────────────────────────────
      const otherDriverTrip = await prisma.trip.create({
        data: {
          tenantId: alpha.tenantId,
          routeId: alphaRouteId,
          vehicleId: alpha.device!.vehicleId,
          driverUserId: secondDriver.id,
          scheduledStart: new Date(now + 3600_000),
          direction: 'morning_pickup',
          status: 'scheduled',
        },
      });
      otherDriverTripId = otherDriverTrip.id;

      // ── 21 completed trips for secondDriver (limit test) ─────────────────────
      for (let i = 0; i < 21; i++) {
        await prisma.trip.create({
          data: {
            tenantId: alpha.tenantId,
            routeId: alphaRouteId,
            vehicleId: alpha.device!.vehicleId,
            driverUserId: secondDriver.id,
            scheduledStart: new Date(now - (i + 2) * 3600_000),
            direction: 'morning_pickup',
            status: 'completed' as any,
            startedAt: new Date(now - (i + 2) * 3600_000),
            endedAt: new Date(now - (i + 1) * 3600_000),
          },
        });
      }

      // ── Passengers on the active trip ────────────────────────────────────────
      // student1 = onboard (boardedAt set, no alightedAt)
      await prisma.tripPassenger.create({
        data: {
          tenantId: alpha.tenantId,
          tripId: activeTripId,
          studentId: student1.id,
          expected: true,
          boardedAt: new Date(now - 1200_000),
        },
      });
      // student2 = alighted (boardedAt and alightedAt set)
      await prisma.tripPassenger.create({
        data: {
          tenantId: alpha.tenantId,
          tripId: activeTripId,
          studentId: student2.id,
          expected: true,
          boardedAt: new Date(now - 1500_000),
          alightedAt: new Date(now - 600_000),
        },
      });
      // student3 = unexpected show-up (expected: false); must NOT count toward passengerSummary.expected
      const student3 = await prisma.student.create({
        data: {
          tenantId: alpha.tenantId,
          admissionNumber: `STU-003-${suffix}`,
          legalName: 'Student Three',
          dateOfBirth: new Date('2015-03-01'),
          gender: 'male',
        },
      });
      await prisma.tripPassenger.create({
        data: {
          tenantId: alpha.tenantId,
          tripId: activeTripId,
          studentId: student3.id,
          expected: false,
          boardedAt: new Date(now - 900_000),
        },
      });

      // ── Location snapshot on the active trip ─────────────────────────────────
      await prisma.$executeRaw`
        INSERT INTO trip_location_snapshots (id, "tenantId", "tripId", "speedKph", "headingDeg", "recordedAt", location)
        VALUES (
          ${randomUUID()}::uuid, ${alpha.tenantId}::uuid, ${activeTripId}::uuid,
          25.0, 90.0, NOW(),
          ST_SetSRID(ST_MakePoint(36.8219, -1.2921), 4326)::geography
        )
      `;

      // ── Beta route and trip ──────────────────────────────────────────────────
      const betaRouteId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO routes (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
        VALUES (
          ${betaRouteId}::uuid, ${beta.tenantId}::uuid, 'Beta Route', 'workspace beta route', true,
          ST_SetSRID(ST_MakePoint(36.8, -1.3), 4326)::geography,
          ST_SetSRID(ST_MakePoint(36.9, -1.4), 4326)::geography,
          NOW(), NOW()
        )
      `;
      const betaTrip = await prisma.trip.create({
        data: {
          tenantId: beta.tenantId,
          routeId: betaRouteId,
          vehicleId: beta.device!.vehicleId,
          driverUserId: beta.driverUserId,
          scheduledStart: new Date(now + 3600_000),
          direction: 'morning_pickup',
          status: 'scheduled',
        },
      });
      betaTripId = betaTrip.id;
    });
  });

  afterAll(async () => {
    await cleanupTenant(prisma, alpha.tenantId);
    await cleanupTenant(prisma, beta.tenantId);
    await app.close();
  });

  // ─── GET /v1/trips/driver-workspace ────────────────────────────────────────
  describe('GET /v1/trips/driver-workspace', () => {
    it('returns active, upcoming, and recent trips scoped to the authenticated driver', async () => {
      const workspace = await request(app.getHttpServer())
        .get('/v1/trips/driver-workspace')
        .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .expect(200);

      expect(workspace.body.activeTrip.id).toBe(activeTripId);
      expect(workspace.body.upcomingTrips.map((trip: { id: string }) => trip.id)).toEqual([
        nextTripId,
        laterTripId,
      ]);
      expect(workspace.body.recentTrips.map((trip: { id: string }) => trip.id)).toEqual([
        latestFinalTripId,
        olderFinalTripId,
      ]);
      expect(JSON.stringify(workspace.body)).not.toContain(otherDriverTripId);
      expect(JSON.stringify(workspace.body)).not.toContain(betaTripId);
    });

    it('caps recentTrips at 20 when driver has more than 20 final trips', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/trips/driver-workspace')
        .set('Authorization', `Bearer ${secondDriverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .expect(200);

      expect(res.body.recentTrips.length).toBe(20);
    });
  });

  // ─── GET /v1/trips/driver/:id ───────────────────────────────────────────────
  describe('GET /v1/trips/driver/:id', () => {
    it('returns full trip detail with route, vehicle, passenger summary, and snapshots', async () => {
      const detail = await request(app.getHttpServer())
        .get(`/v1/trips/driver/${activeTripId}`)
        .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .expect(200);

      expect(detail.body).toMatchObject({
        id: activeTripId,
        route: {
          name: 'Alpha Route',
          startPoint: { lat: -1.2864, lng: 36.8219 },
          endPoint: { lat: -1.3, lng: 36.83 },
          busStops: [
            {
              name: 'Junction A',
              pickupOrder: 1,
              location: { lat: -1.29, lng: 36.825 },
            },
          ],
        },
        vehicle: { registration: expect.any(String) },
        passengerSummary: {
          // 3 passengers total, but only 2 have expected:true — proves the filter
          expected: 2,
          boarded: 3,
          onBoard: 2,
          alighted: 1,
        },
      });
      expect(detail.body.locationSnapshots).toEqual([
        expect.objectContaining({ lat: -1.2921, lng: 36.8219 }),
      ]);
    });

    it('includes assigned assistant details, and null when unassigned', async () => {
      const detail = await request(app.getHttpServer())
        .get(`/v1/trips/driver/${activeTripId}`)
        .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .expect(200);

      expect(detail.body.assistant).toEqual({ id: assistantUserId, fullName: assistantFullName });

      const unassigned = await request(app.getHttpServer())
        .get(`/v1/trips/driver/${nextTripId}`)
        .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .expect(200);

      expect(unassigned.body.assistant).toBeNull();
    });

    it('returns 404 for a trip assigned to another driver', async () => {
      await request(app.getHttpServer())
        .get(`/v1/trips/driver/${otherDriverTripId}`)
        .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .expect(404);
    });

    it('returns 404 for a trip in another tenant', async () => {
      await request(app.getHttpServer())
        .get(`/v1/trips/driver/${betaTripId}`)
        .set('Authorization', `Bearer ${alpha.driverAccessToken}`)
        .set('x-tenant-id', alpha.tenantId)
        .expect(404);
    });
  });
});
