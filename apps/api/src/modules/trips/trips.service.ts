import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TripStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginated, buildPagination } from '../../common/pagination/pagination';
import { requireTenantId } from '../../common/context/request-context';
import { ERROR_CODES } from '@safari-shule/shared-types';
import type { TripInput, PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async driverWorkspace(driverUserId: string) {
    const tenantId = requireTenantId();
    const summaryInclude = {
      route: { select: { id: true, name: true } },
      vehicle: { select: { id: true, registration: true, capacity: true } },
      _count: { select: { passengers: true } },
    } satisfies Prisma.TripInclude;

    const [activeTrip, upcomingTrips, recentTrips] = await Promise.all([
      this.prisma.trip.findFirst({
        where: { tenantId, driverUserId, status: TripStatus.in_progress },
        include: summaryInclude,
      }),
      this.prisma.trip.findMany({
        where: { tenantId, driverUserId, status: TripStatus.scheduled },
        include: summaryInclude,
        orderBy: { scheduledStart: 'asc' },
      }),
      this.prisma.trip.findMany({
        where: { tenantId, driverUserId, status: { in: [TripStatus.completed, TripStatus.cancelled] } },
        include: summaryInclude,
        orderBy: [{ endedAt: 'desc' }, { scheduledStart: 'desc' }],
        take: 20,
      }),
    ]);

    return { activeTrip, upcomingTrips, recentTrips };
  }

  async driverDetail(id: string, driverUserId: string) {
    const tenantId = requireTenantId();
    const trip = await this.prisma.trip.findFirst({
      where: { id, driverUserId, tenantId },
      include: {
        vehicle: { select: { id: true, registration: true, capacity: true } },
        passengers: true,
      },
    });
    if (!trip) throw new NotFoundException();

    const routeRows = await this.prisma.$queryRaw<{
      routeId: string;
      routeName: string;
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
      busStopId: string | null;
      busStopName: string | null;
      pickupOrder: number | null;
      stopLat: number | null;
      stopLng: number | null;
    }[]>`
      SELECT
        r.id AS "routeId",
        r.name AS "routeName",
        ST_Y(r."startPoint"::geometry)::float8 AS "startLat",
        ST_X(r."startPoint"::geometry)::float8 AS "startLng",
        ST_Y(r."endPoint"::geometry)::float8 AS "endLat",
        ST_X(r."endPoint"::geometry)::float8 AS "endLng",
        bs.id AS "busStopId",
        bs.name AS "busStopName",
        bs."pickupOrder",
        ST_Y(bs.location::geometry)::float8 AS "stopLat",
        ST_X(bs.location::geometry)::float8 AS "stopLng"
      FROM routes r
      LEFT JOIN bus_stops bs ON bs."routeId" = r.id AND bs."tenantId" = ${tenantId}::uuid
      WHERE r.id = ${trip.routeId}::uuid
        AND r."tenantId" = ${tenantId}::uuid
      ORDER BY bs."pickupOrder" ASC NULLS LAST
    `;

    if (!routeRows.length) throw new NotFoundException();

    const firstRow = routeRows[0];
    const route = {
      id: firstRow.routeId,
      name: firstRow.routeName,
      startPoint: { lat: firstRow.startLat, lng: firstRow.startLng },
      endPoint: { lat: firstRow.endLat, lng: firstRow.endLng },
      busStops: routeRows
        .filter((r) => r.busStopId !== null)
        .map((r) => ({
          id: r.busStopId,
          name: r.busStopName,
          pickupOrder: r.pickupOrder,
          location: { lat: r.stopLat, lng: r.stopLng },
        })),
    };

    const passengerSummary = {
      expected: trip.passengers.filter((p) => p.expected).length,
      boarded: trip.passengers.filter((p) => p.boardedAt !== null).length,
      onBoard: trip.passengers.filter((p) => p.boardedAt !== null && p.alightedAt === null).length,
      alighted: trip.passengers.filter((p) => p.alightedAt !== null).length,
    };

    const locationSnapshots = await this.prisma.$queryRaw<{
      lat: number;
      lng: number;
      speedKph: number;
      headingDeg: number;
      recordedAt: Date;
    }[]>`
      SELECT
        ST_Y(location::geometry)::float8 AS lat,
        ST_X(location::geometry)::float8 AS lng,
        "speedKph",
        "headingDeg",
        "recordedAt"
      FROM trip_location_snapshots
      WHERE "tripId" = ${trip.id}::uuid
        AND "tenantId" = ${tenantId}::uuid
      ORDER BY "recordedAt" ASC
    `;

    const { passengers: _passengers, ...tripData } = trip;
    return {
      ...tripData,
      route,
      passengerSummary,
      locationSnapshots: locationSnapshots.map((s) => ({
        ...s,
        recordedAt: s.recordedAt.toISOString(),
      })),
    };
  }

  async list(q: PaginationQuery & { status?: string; sortAsc?: string; scopeTenantId?: string | null }) {
    const tenantId = q.scopeTenantId !== undefined ? q.scopeTenantId : requireTenantId();
    const where: any = tenantId ? { tenantId } : {};
    if (q.status) where.status = q.status as any;
    const [total, data] = await Promise.all([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        ...buildPagination(q),
        orderBy: { scheduledStart: q.sortAsc === 'true' ? 'asc' : 'desc' },
        include: {
          route: true,
          vehicle: true,
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string) {
    const row = await this.prisma.trip.findFirst({
      where: { id },
      include: {
        route: { select: { id: true, name: true, description: true, isActive: true, tenant: { select: { id: true, name: true, slug: true } } } },
        vehicle: true,
        tenant: { select: { id: true, name: true, slug: true } },
        passengers: {
          include: {
            student: { select: { id: true, legalName: true, admissionNumber: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException();
    const userIds = [row.driverUserId, row.assistantUserId].filter(Boolean) as string[];
    const [locationSnapshots, users] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; lat: number; lng: number; headingDeg: number | null; speedKph: number | null; recordedAt: Date }[]>`
        SELECT
          id,
          ST_Y(location::geometry)::float8 AS lat,
          ST_X(location::geometry)::float8 AS lng,
          "headingDeg",
          "speedKph",
          "recordedAt"
        FROM trip_location_snapshots
        WHERE "tripId" = ${id}::uuid
          AND "tenantId" = ${row.tenantId}::uuid
        ORDER BY "recordedAt" ASC
      `,
      userIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve([]),
    ]);
    const userById = new Map(users.map((user) => [user.id, user]));
    return {
      ...row,
      driver: userById.get(row.driverUserId) ?? null,
      assistant: row.assistantUserId ? (userById.get(row.assistantUserId) ?? null) : null,
      locationSnapshots: locationSnapshots.map((snapshot) => ({
        ...snapshot,
        recordedAt: snapshot.recordedAt.toISOString(),
      })),
    };
  }

  async updateAssignment(id: string, input: { vehicleId?: string; driverUserId?: string; assistantUserId?: string | null; reason?: string | null }) {
    const trip = await this.prisma.trip.findFirst({ where: { id } });
    if (!trip) throw new NotFoundException();
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      throw new BadRequestException('Completed or cancelled trips cannot be reassigned.');
    }
    const nextVehicleId = input.vehicleId;
    const nextDriverUserId = input.driverUserId;
    const nextAssistantUserId = input.assistantUserId;
    if (!nextVehicleId && !nextDriverUserId && nextAssistantUserId === undefined) {
      throw new BadRequestException('Select at least one assignment field to change.');
    }
    if (trip.status === 'in_progress' && !input.reason?.trim()) {
      throw new BadRequestException('Provide a reason for mid-journey reassignment.');
    }

    if (nextVehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: nextVehicleId, tenantId: trip.tenantId },
        select: { id: true, status: true },
      });
      if (!vehicle) throw new BadRequestException('Selected vehicle was not found for this tenant.');
      if (vehicle.status !== 'active') throw new BadRequestException('Selected vehicle must be active for reassignment.');
    }

    if (nextDriverUserId) {
      const driver = await this.prisma.user.findFirst({
        where: {
          id: nextDriverUserId,
          tenantId: trip.tenantId,
          status: 'active',
          userRoles: { some: { role: { key: 'driver', tenantId: trip.tenantId } } },
        },
        select: { id: true },
      });
      if (!driver) throw new BadRequestException('Selected driver must be an active driver in this tenant.');
      const activeForNewDriver = await this.findActiveTripId(trip.tenantId, nextDriverUserId, id);
      if (activeForNewDriver) throw this.activeTripConflict(activeForNewDriver);
    }

    if (nextAssistantUserId !== undefined && nextAssistantUserId !== null) {
      const assistant = await this.prisma.user.findFirst({
        where: {
          id: nextAssistantUserId,
          tenantId: trip.tenantId,
          status: 'active',
          userRoles: { some: { role: { key: 'assistant', tenantId: trip.tenantId } } },
        },
        select: { id: true },
      });
      if (!assistant) throw new BadRequestException('Selected assistant must be an active assistant in this tenant.');
    }

    try {
      return await this.prisma.trip.update({
        where: { id },
        data: {
          ...(nextVehicleId ? { vehicleId: nextVehicleId } : {}),
          ...(nextDriverUserId ? { driverUserId: nextDriverUserId } : {}),
          ...(nextAssistantUserId !== undefined ? { assistantUserId: nextAssistantUserId } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const conflictDriverId = nextDriverUserId ?? trip.driverUserId;
        const activeTripId = await this.findActiveTripId(trip.tenantId, conflictDriverId, id);
        throw activeTripId
          ? this.activeTripConflict(activeTripId)
          : new ConflictException({
              code: ERROR_CODES.TRIP_ALREADY_ACTIVE,
              message: 'Driver already has a trip in progress.',
              details: { activeTripId: null },
            });
      }
      throw error;
    }
  }

  create(input: TripInput & { targetTenantId?: string }) {
    const tenantId = input.targetTenantId ?? requireTenantId();
    return this.prisma.trip.create({
      data: {
        tenantId,
        routeId: input.routeId,
        vehicleId: input.vehicleId,
        driverUserId: input.driverUserId,
        assistantUserId: input.assistantUserId ?? null,
        scheduledStart: new Date(input.scheduledStart),
        direction: input.direction as any,
      },
    });
  }

  private activeTripConflict(activeTripId: string): ConflictException {
    return new ConflictException({
      code: ERROR_CODES.TRIP_ALREADY_ACTIVE,
      message: 'Driver already has a trip in progress.',
      details: { activeTripId },
    });
  }

  private async findActiveTripId(
    tenantId: string,
    driverUserId: string,
    excludeTripId?: string,
  ): Promise<string | null> {
    const active = await this.prisma.trip.findFirst({
      where: {
        tenantId,
        driverUserId,
        status: 'in_progress',
        ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
      },
      select: { id: true },
    });
    return active?.id ?? null;
  }

  private async startTrip(id: string, assignedDriverUserId?: string) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id,
        ...(assignedDriverUserId ? { driverUserId: assignedDriverUserId } : {}),
      },
    });
    if (!trip) throw new NotFoundException();
    if (trip.status !== 'scheduled') {
      throw new BadRequestException({ code: 'TRIP_NOT_SCHEDULED' });
    }
    const activeTripId = await this.findActiveTripId(trip.tenantId, trip.driverUserId, trip.id);
    if (activeTripId) throw this.activeTripConflict(activeTripId);

    try {
      return await this.prisma.trip.update({
        where: { id: trip.id },
        data: { status: 'in_progress', startedAt: new Date() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winnerId = await this.findActiveTripId(trip.tenantId, trip.driverUserId);
        throw winnerId
          ? this.activeTripConflict(winnerId)
          : new ConflictException({
              code: ERROR_CODES.TRIP_ALREADY_ACTIVE,
              message: 'Driver already has a trip in progress.',
              details: { activeTripId: null },
            });
      }
      throw error;
    }
  }

  start(id: string) {
    return this.startTrip(id);
  }

  startForAssignedDriver(id: string, driverUserId: string) {
    return this.startTrip(id, driverUserId);
  }

  async end(id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id } });
    if (!trip) throw new NotFoundException();
    if (trip.status !== 'in_progress') throw new BadRequestException({ code: 'TRIP_NOT_IN_PROGRESS' });
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'completed' as any, endedAt: new Date() },
    });
  }

  async endForAssignedDriver(id: string, driverUserId: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id, driverUserId } });
    if (!trip) throw new NotFoundException();
    if (trip.status !== 'in_progress') throw new BadRequestException({ code: 'TRIP_NOT_IN_PROGRESS' });
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'completed' as any, endedAt: new Date() },
    });
  }

  async cancel(id: string, reason: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id } });
    if (!trip) throw new NotFoundException();
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      throw new BadRequestException({ code: 'TRIP_FINAL_STATE' });
    }
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'cancelled', endedAt: new Date(), cancellationReason: reason },
    });
  }
}
