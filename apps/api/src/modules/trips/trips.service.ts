import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginated, buildPagination } from '../../common/pagination/pagination';
import { requireTenantId } from '../../common/context/request-context';
import type { TripInput, PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PaginationQuery & { status?: string }) {
    const where: any = {};
    if (q.status) where.status = q.status as any;
    const [total, data] = await Promise.all([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        ...buildPagination(q),
        include: { route: true, vehicle: true },
      }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string) {
    const row = await this.prisma.trip.findFirst({
      where: { id },
      include: {
        route: { include: { busStops: true } },
        vehicle: true,
        attendanceEvents: { orderBy: { scannedAt: 'asc' } },
        passengers: true,
      },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  create(input: TripInput) {
    const tenantId = requireTenantId();
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

  async end(id: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id } });
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
