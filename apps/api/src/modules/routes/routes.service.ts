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

  async listRoutes(q: PaginationQuery & { isActive?: string; scopeTenantId?: string | null }) {
    const tenantId = q.scopeTenantId !== undefined ? q.scopeTenantId : requireTenantId();
    const where: any = tenantId ? { tenantId } : {};
    if (q.q) where.name = { contains: q.q, mode: 'insensitive' };
    if (q.isActive !== undefined) where.isActive = q.isActive === 'true';
    const [total, data] = await Promise.all([
      this.prisma.route.count({ where }),
      this.prisma.route.findMany({ where, ...buildPagination(q), orderBy: { name: 'asc' }, include: { tenant: { select: { id: true, name: true, slug: true } }, _count: { select: { busStops: true, studentAssignments: true } } } }),
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

  async createRoute(input: RouteInput & { targetTenantId?: string }) {
    const tenantId = input.targetTenantId ?? requireTenantId();
    const routeId = randomUUID();
    await this.prisma.$transaction(async (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => {
      // Bind the correct tenant so the RLS WITH CHECK passes for all INSERTs in this transaction
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId.replace(/'/g, "''")}'`);
      await tx.$executeRaw`
        INSERT INTO routes
          (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
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
            (id, "tenantId", "routeId", name, "pickupOrder", "scheduledPickupTime", "scheduledDropoffTime", location)
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

  async getRouteStops(routeId: string) {
    return this.prisma.$queryRaw<{ id: string; name: string; lat: number; lng: number; pickupOrder: number; scheduledPickupTime: string; scheduledDropoffTime: string }[]>`
      SELECT id, name,
        ST_Y(location::geometry)::float8 AS lat,
        ST_X(location::geometry)::float8 AS lng,
        "pickupOrder", "scheduledPickupTime", "scheduledDropoffTime"
      FROM bus_stops
      WHERE "routeId" = ${routeId}::uuid
      ORDER BY "pickupOrder" ASC
    `;
  }

  async replaceRouteStops(routeId: string, stops: { name: string; lat: number; lng: number; pickupOrder: number; scheduledPickupTime: string; scheduledDropoffTime: string }[]) {
    const route = await this.prisma.route.findFirst({ where: { id: routeId } });
    if (!route) throw new NotFoundException();
    const tenantId = route.tenantId;
    await this.prisma.$transaction(async (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId.replace(/'/g, "''")}'`);
      await tx.$executeRaw`DELETE FROM bus_stops WHERE "routeId" = ${routeId}::uuid`;
      for (const stop of stops) {
        const stopId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO bus_stops (id, "tenantId", "routeId", name, "pickupOrder", "scheduledPickupTime", "scheduledDropoffTime", location)
          VALUES (
            ${stopId}::uuid, ${tenantId}::uuid, ${routeId}::uuid,
            ${stop.name}, ${stop.pickupOrder}, ${stop.scheduledPickupTime}, ${stop.scheduledDropoffTime},
            ST_SetSRID(ST_MakePoint(${stop.lng}, ${stop.lat}), 4326)::geography
          )
        `;
      }
    });
    return { routeId, count: stops.length };
  }

  async createGeofence(input: GeofenceInput) {
    const tenantId = requireTenantId();
    if (input.polygon.length < 3) throw new BadRequestException('Polygon must have at least 3 points.');
    const id = randomUUID();
    const wkt = polygonToWkt(input.polygon);
    await this.prisma.$executeRaw`
      INSERT INTO geofences
        (id, "tenantId", name, kind, "routeId", "vehicleId", polygon, "createdAt")
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

  async patchRoute(id: string, patch: { name?: string; description?: string | null; isActive?: boolean; targetTenantId?: string }) {
    return this.prisma.route.update({
      where: { id },
      data: {
        ...(patch.targetTenantId ? { tenantId: patch.targetTenantId } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      },
    });
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
