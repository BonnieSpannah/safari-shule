import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { paginationQuery } from '@safari-shule/shared-types';
import { RequirePermission } from '../../rbac/permission.decorators';
import { RbacService } from '../../rbac/rbac.service';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../common/validation/zod-pipe';
import { runWithBypass } from '../../common/context/request-context';
import { resolveTenantScope } from '../../common/tenant/tenant-scope';
import { RfidDevicesService } from './rfid-devices.service';

const registerSchema = z.object({
  deviceId: z.string().min(3).max(64),
  vehicleId: z.string().uuid().nullable().optional(),
});

const statusSchema = z.object({
  status: z.enum(['active', 'rotating', 'disabled'] as const),
});

@ApiTags('hardware')
@Controller('rfid-devices')
export class RfidDevicesController {
  constructor(private readonly svc: RfidDevicesService, private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('rfid_devices.view')
  async list(
    @Req() req: Request,
    @ZodQuery(paginationQuery.extend({ status: z.string().optional(), tenantId: z.string().uuid().optional() })) q: z.infer<typeof paginationQuery> & { status?: string; tenantId?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const run = () => this.svc.list({ ...q, scopeTenantId: scope.tenantId });
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Post()
  @RequirePermission('rfid_devices.manage')
  @Audited({ action: 'rfid_device.register', entityType: 'rfid_device', redactFields: ['apiKey', 'hmacSecret'] })
  register(@ZodBody(registerSchema) body: z.infer<typeof registerSchema>) {
    return this.svc.register(body);
  }

  @Patch(':id/status')
  @RequirePermission('rfid_devices.manage')
  @Audited({ action: 'rfid_device.status_change', entityType: 'rfid_device', entityIdParam: 'id' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @ZodBody(statusSchema) body: z.infer<typeof statusSchema>) {
    return this.svc.setStatus(id, body.status);
  }
}
