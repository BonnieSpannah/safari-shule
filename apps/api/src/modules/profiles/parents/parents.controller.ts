import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { parentInput, paginationQuery, PARENT_RELATIONS } from '@safari-shule/shared-types';
import { z } from 'zod';
import { RequirePermission } from '../../../rbac/permission.decorators';
import { Audited } from '../../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-pipe';
import { ParentsService } from './parents.service';

const linkSchema = z.object({
  studentId: z.string().uuid(),
  relation: z.enum(PARENT_RELATIONS).default('guardian'),
  isPrimary: z.boolean().default(false),
});

@ApiTags('parents')
@Controller('parents')
export class ParentsController {
  constructor(private readonly svc: ParentsService) {}

  @Get()
  @RequirePermission('parents.view')
  list(@ZodQuery(paginationQuery) q: z.infer<typeof paginationQuery>) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermission('parents.view')
  one(@Param('id') id: string) {
    return this.svc.byId(id);
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
    return this.svc.linkStudent(id, body.studentId, body.relation, body.isPrimary);
  }
}
