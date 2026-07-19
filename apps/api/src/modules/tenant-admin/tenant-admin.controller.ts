import { Controller, Get, Post, Patch, Param } from '@nestjs/common';
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
  contactPhone: z.string().regex(/^\+\d{7,15}$/).optional(),
  planTier: z.enum(['basic', 'pro', 'enterprise']),
  initialAdmin: z.object({
    email: z.string().email(),
    fullName: z.string().min(2),
    phone: z.string().regex(/^\+254[17]\d{8}$/).optional(),
    password: z.string().min(10),
  }),
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().regex(/^\+\d{7,15}$/).nullable().optional(),
  planTier: z.enum(['basic', 'pro', 'enterprise']).optional(),
});

const statusSchema = z.object({
  status: z.enum(['active', 'suspended', 'deactivated', 'deleted']),
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

  @Patch(':id')
  @RequirePermission('tenants.manage')
  @Audited({ action: 'tenant.update', entityType: 'tenant' })
  update(@Param('id') id: string, @ZodBody(updateSchema) body: z.infer<typeof updateSchema>) {
    return this.svc.updateTenant(id, body);
  }

  @Patch(':id/status')
  @RequirePermission('tenants.manage')
  @Audited({ action: 'tenant.status_change', entityType: 'tenant' })
  setStatus(@Param('id') id: string, @ZodBody(statusSchema) body: z.infer<typeof statusSchema>) {
    return this.svc.setTenantStatus(id, body.status);
  }
}
