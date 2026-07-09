import { Module, Global } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PermissionGuard } from './permission.guard';

@Global()
@Module({
  providers: [RbacService, PermissionGuard],
  exports: [RbacService],
})
export class RbacModule {}
