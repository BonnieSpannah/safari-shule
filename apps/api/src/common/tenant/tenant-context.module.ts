import { Module, Global } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantResolverService } from './tenant-resolver.service';

@Global()
@Module({
  providers: [TenantResolverService],
  exports: [TenantResolverService],
})
export class TenantContextModule {}
