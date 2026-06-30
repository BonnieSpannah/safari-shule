import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { caretakerInput, paginationQuery } from '@safari-shule/shared-types';
import { z } from 'zod';
import { RequirePermission } from '../../../rbac/permission.decorators';
import { Audited } from '../../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-pipe';
import { CaretakersService } from './caretakers.service';

@ApiTags('caretakers')
@Controller('caretakers')
export class CaretakersController {
  constructor(private readonly svc: CaretakersService) {}

  @Get()
  @RequirePermission('caretakers.view')
  list(@ZodQuery(paginationQuery) q: z.infer<typeof paginationQuery>) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermission('caretakers.view')
  one(@Param('id') id: string) {
    return this.svc.byId(id);
  }

  @Post()
  @RequirePermission('caretakers.create')
  @Audited({ action: 'caretaker.create', entityType: 'caretaker' })
  create(@ZodBody(caretakerInput) body: z.infer<typeof caretakerInput>) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @RequirePermission('caretakers.edit')
  @Audited({ action: 'caretaker.update', entityType: 'caretaker', entityIdParam: 'id' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('caretakers.delete')
  @Audited({ action: 'caretaker.delete', entityType: 'caretaker', entityIdParam: 'id' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
