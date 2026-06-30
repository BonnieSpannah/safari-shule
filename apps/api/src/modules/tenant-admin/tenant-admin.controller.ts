import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RequirePermission } from '../../rbac/permission.decorators';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody } from '../../common/validation/zod-pipe';
import { TenantAdminService } from './tenant-admin.service';

const bootstrapSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/),
  subdomain: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/),
  name: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  planTier: z.enum(['basic', 'pro', 'enterprise']),
  initialAdmin: z.object({
    email: z.string().email(),
    fullName: z.string().min(2),
    phone: z.string().regex(/^\+254[17]\d{8}$/).optional(),
    password: z.string().min(10),
  }),
});

@ApiTags('admin')
@Controller('admin/tenants')
export class TenantAdminController {
  constructor(private readonly svc: TenantAdminService) {}

  @Get()
  @RequirePermission('tenants.manage')
  list() {
    return this.svc.listTenants();
  }

  @Post()
  @RequirePermission('tenants.manage')
  @Audited({ action: 'tenant.bootstrap', entityType: 'tenant' })
  create(@ZodBody(bootstrapSchema) body: z.infer<typeof bootstrapSchema>) {
    return this.svc.createTenant(body);
  }
}
