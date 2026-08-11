import { Module } from '@nestjs/common';
import { HardwareService } from './hardware.service';
import { HardwareController } from './hardware.controller';
import { HardwareAuthGuard } from './hardware-auth.guard';
import { RfidDevicesService } from './rfid-devices.service';
import { RfidDevicesController } from './rfid-devices.controller';

@Module({
  providers: [HardwareService, HardwareAuthGuard, RfidDevicesService],
  controllers: [HardwareController, RfidDevicesController],
})
export class HardwareModule {}
