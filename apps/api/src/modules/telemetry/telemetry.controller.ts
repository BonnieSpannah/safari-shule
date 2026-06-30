import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RequirePermission } from '../../rbac/permission.decorators';
import { ZodBody } from '../../common/validation/zod-pipe';
import { TelemetryService } from './telemetry.service';
import { TripGateway } from './trip.gateway';
import { requireTenantId } from '../../common/context/request-context';

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
      lat: body.lat,
      lng: body.lng,
      heading_degrees: body.heading_degrees,
      speed_mps: body.speed_mps,
      timestamp: body.timestamp,
    });
    return { ok: true };
  }
}
