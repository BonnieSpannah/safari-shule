import { Module } from '@nestjs/common';
import { HardwareService } from './hardware.service';
import { HardwareController } from './hardware.controller';
import { HardwareAuthGuard } from './hardware-auth.guard';

@Module({
  providers: [HardwareService, HardwareAuthGuard],
  controllers: [HardwareController],
})
export class HardwareModule {}
