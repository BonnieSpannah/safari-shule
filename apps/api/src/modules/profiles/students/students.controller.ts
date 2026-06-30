import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { studentInput, paginationQuery } from '@safari-shule/shared-types';
import { z } from 'zod';
import { RequirePermission } from '../../../rbac/permission.decorators';
import { Audited } from '../../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-pipe';
import { StudentsService } from './students.service';

@ApiTags('students')
@Controller('students')
export class StudentsController {
  constructor(private readonly svc: StudentsService) {}

  @Get()
  @RequirePermission('students.view')
  list(@ZodQuery(paginationQuery) q: z.infer<typeof paginationQuery>) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermission('students.view')
  one(@Param('id') id: string) {
    return this.svc.byId(id);
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
