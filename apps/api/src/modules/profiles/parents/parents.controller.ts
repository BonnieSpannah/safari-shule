import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { parentInput, paginationQuery, PARENT_RELATIONS } from '@safari-shule/shared-types';
import { z } from 'zod';
import type { Request } from 'express';
import { RequirePermission } from '../../../rbac/permission.decorators';
import { RbacService } from '../../../rbac/rbac.service';
import { Audited } from '../../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-pipe';
import { runWithBypass } from '../../../common/context/request-context';
import { resolveTenantScope } from '../../../common/tenant/tenant-scope';
import { ParentsService } from './parents.service';

const linkSchema = z.object({
  studentId: z.string().uuid(),
  relation: z.enum(PARENT_RELATIONS).default('guardian'),
  isPrimary: z.boolean().default(false),
  sourceTenantId: z.string().uuid().optional(),
});

@ApiTags('parents')
@Controller('parents')
export class ParentsController {
  constructor(private readonly svc: ParentsService, private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('parents.view')
  async list(
    @Req() req: Request,
    @ZodQuery(paginationQuery.extend({ tenantId: z.string().uuid().optional() })) q: z.infer<typeof paginationQuery> & { tenantId?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const run = () => this.svc.list({ ...q, scopeTenantId: scope.tenantId });
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get(':id')
  @RequirePermission('parents.view')
  one(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.svc.byId(id, tenantId);
  }

  @Post()
  @RequirePermission('parents.create')
  @Audited({ action: 'parent.create', entityType: 'parent' })
  create(@ZodBody(parentInput) body: z.infer<typeof parentInput>) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @RequirePermission('parents.edit')
  @Audited({ action: 'parent.update', entityType: 'parent', entityIdParam: 'id' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('parents.delete')
  @Audited({ action: 'parent.delete', entityType: 'parent', entityIdParam: 'id' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/students')
  @RequirePermission('parents.edit')
  @Audited({ action: 'parent.link_student', entityType: 'parent', entityIdParam: 'id' })
  link(@Param('id') id: string, @ZodBody(linkSchema) body: z.infer<typeof linkSchema>) {
    return this.svc.linkStudent(id, body.studentId, body.relation, body.isPrimary, body.sourceTenantId);
  }
}
