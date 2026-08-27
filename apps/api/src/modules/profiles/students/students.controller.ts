import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { studentInput, paginationQuery } from '@safari-shule/shared-types';
import { z } from 'zod';
import type { Request } from 'express';
import { RequirePermission } from '../../../rbac/permission.decorators';
import { RbacService } from '../../../rbac/rbac.service';
import { Audited } from '../../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-pipe';
import { runWithBypass } from '../../../common/context/request-context';
import { resolveTenantScope } from '../../../common/tenant/tenant-scope';
import { StudentsService } from './students.service';

@ApiTags('students')
@Controller('students')
export class StudentsController {
  constructor(private readonly svc: StudentsService, private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('students.view')
  async list(
    @Req() req: Request,
    @ZodQuery(paginationQuery.extend({ gender: z.string().optional(), classroom: z.string().optional(), tenantId: z.string().uuid().optional() })) q: z.infer<typeof paginationQuery> & { gender?: string; classroom?: string; tenantId?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const run = () => this.svc.list({ ...q, scopeTenantId: scope.tenantId });
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get(':id')
  @RequirePermission('students.view')
  one(@Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.svc.byId(id, tenantId);
  }

  @Post()
  @RequirePermission('students.create')
  @Audited({ action: 'student.create', entityType: 'student' })
  create(@ZodBody(studentInput) body: z.infer<typeof studentInput>) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @RequirePermission('students.edit')
  @Audited({ action: 'student.update', entityType: 'student', entityIdParam: 'id' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('students.delete')
  @Audited({ action: 'student.delete', entityType: 'student', entityIdParam: 'id' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
