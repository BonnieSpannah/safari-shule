import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginated, buildPagination } from '../../common/pagination/pagination';
import { requireTenantId } from '../../common/context/request-context';
import type { TripInput, PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const [row, locationSnapshots] = await Promise.all([
      this.prisma.trip.findFirst({
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
      }),
      this.prisma.$queryRaw<{ id: string; lat: number; lng: number; headingDeg: number | null; speedKph: number | null; recordedAt: Date }[]>`
        SELECT
          id,
          ST_Y(location::geometry)::float8 AS lat,
          ST_X(location::geometry)::float8 AS lng,
          heading_degrees AS "headingDeg",
          speed_mps * 3.6 AS "speedKph",
          occurred_at AS "recordedAt"
        FROM trip_location_snapshots
        WHERE "trip_id" = ${id}::uuid
        ORDER BY "occurred_at" ASC
      `,
    ]);
    if (!row) throw new NotFoundException();
    const userIds = [row.driverUserId, row.assistantUserId].filter(Boolean) as string[];
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true },
      })
      : [];
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

    return this.prisma.trip.update({
      where: { id },
      data: {
        ...(nextVehicleId ? { vehicleId: nextVehicleId } : {}),
        ...(nextDriverUserId ? { driverUserId: nextDriverUserId } : {}),
        ...(nextAssistantUserId !== undefined ? { assistantUserId: nextAssistantUserId } : {}),
      },
    });
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

  async start(id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id } });
    if (!trip) throw new NotFoundException();
    if (trip.status !== 'scheduled') throw new BadRequestException({ code: 'TRIP_NOT_SCHEDULED' });
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'in_progress' as any, startedAt: new Date() },
    });
  }

  async startForAssignedDriver(id: string, driverUserId: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id, driverUserId } });
    if (!trip) throw new NotFoundException();
    if (trip.status !== 'scheduled') throw new BadRequestException({ code: 'TRIP_NOT_SCHEDULED' });
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'in_progress' as any, startedAt: new Date() },
    });
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

  async cancel(id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id } });
    if (!trip) throw new NotFoundException();
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      throw new BadRequestException({ code: 'TRIP_FINAL_STATE' });
    }
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'cancelled' as any, endedAt: new Date() },
    });
  }
}
