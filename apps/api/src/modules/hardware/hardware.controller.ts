import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { z } from 'zod';
import { Public } from '../../auth/public.decorator';
import { ZodBody } from '../../common/validation/zod-pipe';
import { HardwareAuthGuard } from './hardware-auth.guard';
import { HardwareService } from './hardware.service';

const rfidScanSchema = z.object({
  device_id: z.string().min(3),
  tag_uid: z.string().min(4).max(64),
  timestamp: z.number().int().positive(),
});

const gpsSchema = z.object({
  device_id: z.string().min(3),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  heading_deg: z.number().gte(0).lte(360).optional(),
  speed_kph: z.number().gte(0).optional(),
  timestamp: z.number().int().positive(),
});

interface HardwareReq extends Request {
  tenantId: string;
  deviceDbId: string;
  deviceRow: { vehicleId: string | null };
}

@ApiTags('hardware')
@Controller('hardware')
export class HardwareController {
  constructor(private readonly svc: HardwareService) {}

  @Public()
  @UseGuards(HardwareAuthGuard)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post('rfid-scan')
  rfidScan(@Req() req: HardwareReq, @ZodBody(rfidScanSchema) body: z.infer<typeof rfidScanSchema>) {
    return this.svc.ingestScan({
      tenantId: req.tenantId,
      deviceDbId: req.deviceDbId,
      tagUid: body.tag_uid,
      scannedAt: new Date(body.timestamp),
      rawPayload: body,
    });
  }

  @Public()
  @UseGuards(HardwareAuthGuard)
  @Throttle({ default: { limit: 1200, ttl: 60_000 } })
  @Post('gps')
  gps(@Req() req: HardwareReq, @ZodBody(gpsSchema) body: z.infer<typeof gpsSchema>) {
    if (!req.deviceRow.vehicleId) {
      return { stored: false as const, reason: 'DEVICE_NOT_LINKED_TO_VEHICLE' as const };
    }
    return this.svc.ingestGps({
      tenantId: req.tenantId,
      vehicleId: req.deviceRow.vehicleId,
      lat: body.lat,
      lng: body.lng,
      headingDeg: body.heading_deg ?? null,
      speedKph: body.speed_kph ?? null,
      recordedAt: new Date(body.timestamp),
    });
  }
}
