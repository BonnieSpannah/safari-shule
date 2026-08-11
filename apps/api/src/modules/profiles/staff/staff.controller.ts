import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { staffInput, paginationQuery } from '@safari-shule/shared-types';
import { z } from 'zod';
import type { Request } from 'express';
import { RequirePermission } from '../../../rbac/permission.decorators';
import { RbacService } from '../../../rbac/rbac.service';
import { Audited } from '../../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-pipe';
import { runWithBypass } from '../../../common/context/request-context';
import { resolveTenantScope } from '../../../common/tenant/tenant-scope';
import { StaffService } from './staff.service';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly svc: StaffService, private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('staff.view')
  async list(
    @Req() req: Request,
    @ZodQuery(paginationQuery.extend({ tenantId: z.string().uuid().optional() })) q: z.infer<typeof paginationQuery> & { tenantId?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const run = () => this.svc.list({ ...q, scopeTenantId: scope.tenantId });
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get(':id')
  @RequirePermission('staff.view')
  one(@Param('id') id: string) {
    return this.svc.byId(id);
  }

  @Post()
  @RequirePermission('staff.create')
  @Audited({ action: 'staff.create', entityType: 'staff' })
  create(@ZodBody(staffInput) body: z.infer<typeof staffInput>) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @RequirePermission('staff.edit')
  @Audited({ action: 'staff.update', entityType: 'staff', entityIdParam: 'id' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('staff.delete')
  @Audited({ action: 'staff.delete', entityType: 'staff', entityIdParam: 'id' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
