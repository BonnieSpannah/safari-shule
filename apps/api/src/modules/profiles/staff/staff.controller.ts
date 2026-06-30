import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { staffInput, paginationQuery } from '@safari-shule/shared-types';
import { z } from 'zod';
import { RequirePermission } from '../../../rbac/permission.decorators';
import { Audited } from '../../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-pipe';
import { StaffService } from './staff.service';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly svc: StaffService) {}

  @Get()
  @RequirePermission('staff.view')
  list(@ZodQuery(paginationQuery) q: z.infer<typeof paginationQuery>) {
    return this.svc.list(q);
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
