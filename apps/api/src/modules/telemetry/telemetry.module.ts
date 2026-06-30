import { Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { TripGateway } from './trip.gateway';
import { TelemetryFlushService } from './telemetry-flush.service';

@Module({
  providers: [TelemetryService, TripGateway, TelemetryFlushService],
  controllers: [TelemetryController],
})
export class TelemetryModule {}
