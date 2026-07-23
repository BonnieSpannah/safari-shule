import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireTenantId } from '../../common/context/request-context';
import { buildPagination, paginated } from '../../common/pagination/pagination';
import type {
  RouteInput,
  GeofenceInput,
  StudentRouteAssignmentInput,
  LatLng,
  PaginationQuery,
} from '@safari-shule/shared-types';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoutes(q: PaginationQuery & { isActive?: string }) {
    const tenantId = requireTenantId();
    const where: any = { tenantId };
    if (q.q) where.name = { contains: q.q, mode: 'insensitive' };
    if (q.isActive !== undefined) where.isActive = q.isActive === 'true';
    const [total, data] = await Promise.all([
      this.prisma.route.count({ where }),
      this.prisma.route.findMany({ where, ...buildPagination(q), orderBy: { name: 'asc' } }),
    ]);
    return paginated(data, total, q);
  }

  async getRoute(id: string) {
    const route = await this.prisma.route.findFirst({
      where: { id },
      include: { busStops: { orderBy: { pickupOrder: 'asc' } } },
    });
    if (!route) throw new NotFoundException();
    return route;
  }

  async createRoute(input: RouteInput) {
    const tenantId = requireTenantId();
    const routeId = randomUUID();
    await this.prisma.$transaction(async (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => {
      await tx.$executeRaw`
        INSERT INTO routes
          (id, tenant_id, name, description, is_active, start_point, end_point, created_at, updated_at)
        VALUES (
          ${routeId}::uuid,
          ${tenantId}::uuid,
          ${input.name},
          ${input.description ?? null},
          ${input.isActive},
          ST_SetSRID(ST_MakePoint(${input.startPoint.lng}, ${input.startPoint.lat}), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${input.endPoint.lng}, ${input.endPoint.lat}), 4326)::geography,
          NOW(),
          NOW()
        );
      `;
      for (const stop of input.busStops) {
        const stopId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO bus_stops
            (id, tenant_id, route_id, name, pickup_order, scheduled_pickup_time, scheduled_dropoff_time, location)
          VALUES (
            ${stopId}::uuid,
            ${tenantId}::uuid,
            ${routeId}::uuid,
            ${stop.name},
            ${stop.pickupOrder},
            ${stop.scheduledPickupTime},
            ${stop.scheduledDropoffTime},
            ST_SetSRID(ST_MakePoint(${stop.location.lng}, ${stop.location.lat}), 4326)::geography
          );
        `;
      }
    });
    return { id: routeId };
  }

  async createGeofence(input: GeofenceInput) {
    const tenantId = requireTenantId();
    if (input.polygon.length < 3) throw new BadRequestException('Polygon must have at least 3 points.');
    const id = randomUUID();
    const wkt = polygonToWkt(input.polygon);
    await this.prisma.$executeRaw`
      INSERT INTO geofences
        (id, tenant_id, name, kind, route_id, vehicle_id, polygon, created_at)
      VALUES (
        ${id}::uuid,
        ${tenantId}::uuid,
        ${input.name},
        ${input.kind}::"GeofenceKind",
        ${input.routeId ?? null}::uuid,
        ${input.vehicleId ?? null}::uuid,
        ST_SetSRID(ST_GeomFromText(${wkt}), 4326)::geography,
        NOW()
      );
    `;
    return { id };
  }

  async pointInGeofence(geofenceId: string, point: LatLng): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ inside: boolean }[]>`
      SELECT ST_Covers(
        polygon::geometry,
        ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)
      ) AS inside
      FROM geofences
      WHERE id = ${geofenceId}::uuid;
    `;
    return rows[0]?.inside ?? false;
  }

  assignStudentToRoute(input: StudentRouteAssignmentInput) {
    const tenantId = requireTenantId();
    return this.prisma.studentRouteAssignment.create({
      data: {
        tenantId,
        studentId: input.studentId,
        routeId: input.routeId,
        busStopId: input.busStopId,
        validFrom: new Date(input.validFrom),
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
    });
  }

  listAssignmentsForRoute(routeId: string) {
    return this.prisma.studentRouteAssignment.findMany({
      where: { routeId },
      include: {
        student: { select: { id: true, legalName: true, admissionNumber: true } },
        busStop: { select: { id: true, name: true } },
      },
    });
  }
}

function polygonToWkt(points: LatLng[]): string {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const closed = first.lat === last.lat && first.lng === last.lng ? points : [...points, first];
  const coords = closed.map((p) => `${p.lng} ${p.lat}`).join(', ');
  return `POLYGON((${coords}))`;
}
