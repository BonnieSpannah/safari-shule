import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [TelemetryModule],
  providers: [IncidentsService],
  controllers: [IncidentsController],
})
export class IncidentsModule {}
