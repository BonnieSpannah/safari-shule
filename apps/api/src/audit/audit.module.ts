import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService],
})
export class AuditModule {}
