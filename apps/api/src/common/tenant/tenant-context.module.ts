import { Module, Global } from '@nestjs/common';
import { TenantResolverService } from './tenant-resolver.service';

@Global()
@Module({
  providers: [TenantResolverService],
  exports: [TenantResolverService],
})
export class TenantContextModule {}
