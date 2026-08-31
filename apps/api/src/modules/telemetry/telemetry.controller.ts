import { Controller, ForbiddenException, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { RequirePermission } from '../../rbac/permission.decorators';
import { ZodBody } from '../../common/validation/zod-pipe';
import { TelemetryService } from './telemetry.service';
import { TripGateway } from './trip.gateway';
import { requireTenantId } from '../../common/context/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';

const locationSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  heading_degrees: z.number().gte(0).lte(360).optional(),
  speed_mps: z.number().gte(0).optional(),
  timestamp: z.number().int().positive(),
});

@ApiTags('telemetry')
@Controller('trips')
export class TelemetryController {
  constructor(
    private readonly svc: TelemetryService,
    private readonly gateway: TripGateway,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/location')
  @RequirePermission('trips.dispatch')
  async ingest(@Param('id') id: string, @ZodBody(locationSchema) body: z.infer<typeof locationSchema>) {
    const tenantId = requireTenantId();
    await this.svc.ingest({
      tenantId,
      tripId: id,
      lat: body.lat,
      lng: body.lng,
      headingDegrees: body.heading_degrees ?? null,
      speedMps: body.speed_mps ?? null,
      occurredAt: new Date(body.timestamp),
    });
    this.gateway.broadcastLocation(tenantId, id, {
      tripId: id,
      lat: body.lat,
      lng: body.lng,
      heading_degrees: body.heading_degrees,
      speed_mps: body.speed_mps,
      timestamp: body.timestamp,
    });
    return { ok: true };
  }

  @Post(':id/driver-location')
  @RequirePermission('trips.view')
  async ingestFromDriver(
    @Param('id') id: string,
    @Req() req: Request,
    @ZodBody(locationSchema) body: z.infer<typeof locationSchema>,
  ) {
    const tenantId = requireTenantId();
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    if (!userId) {
      throw new ForbiddenException('Authentication required.');
    }
    const trip = await this.prisma.trip.findFirst({
      where: { id, tenantId, driverUserId: userId, status: 'in_progress' },
      select: { id: true },
    });
    if (!trip) {
      throw new ForbiddenException('Only the assigned driver can send telemetry for an in-progress trip.');
    }
    await this.svc.ingest({
      tenantId,
      tripId: id,
      lat: body.lat,
      lng: body.lng,
      headingDegrees: body.heading_degrees ?? null,
      speedMps: body.speed_mps ?? null,
      occurredAt: new Date(body.timestamp),
    });
    this.gateway.broadcastLocation(tenantId, id, {
      tripId: id,
      lat: body.lat,
      lng: body.lng,
      heading_degrees: body.heading_degrees,
      speed_mps: body.speed_mps,
      timestamp: body.timestamp,
    });
    return { ok: true };
  }
}
