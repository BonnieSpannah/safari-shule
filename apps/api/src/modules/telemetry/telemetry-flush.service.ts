import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class TelemetryFlushService implements OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly telemetry: TelemetryService) {
    this.timer = setInterval(() => {
      this.telemetry.flushAll().catch(() => undefined);
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
