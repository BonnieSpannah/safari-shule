import { Module } from '@nestjs/common';
import { TenantAdminService } from './tenant-admin.service';
import { TenantAdminController } from './tenant-admin.controller';

@Module({
  providers: [TenantAdminService],
  controllers: [TenantAdminController],
})
export class TenantAdminModule {}
