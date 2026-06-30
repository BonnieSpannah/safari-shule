import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  attributeDefinitionInput,
  paginationQuery,
  PROFILE_ENTITY_KINDS,
  type ProfileEntityKind,
} from '@safari-shule/shared-types';
import { z } from 'zod';
import { Audited } from '../../audit/audit.decorators';
import { RequirePermission } from '../../rbac/permission.decorators';
import { ZodBody, ZodQuery } from '../../common/validation/zod-pipe';
import { AttributeDefinitionsService } from './attribute-definitions.service';

const listQuery = paginationQuery.extend({
  targetEntity: z.enum(PROFILE_ENTITY_KINDS).optional(),
});
const patchSchema = attributeDefinitionInput.partial();

@ApiTags('attribute-definitions')
@Controller('attribute-definitions')
export class AttributeDefinitionsController {
  constructor(private readonly svc: AttributeDefinitionsService) {}

  @Get()
  @RequirePermission('attribute_definitions.view')
  list(@ZodQuery(listQuery) q: z.infer<typeof listQuery>) {
    return this.svc.list({ ...q, targetEntity: q.targetEntity as ProfileEntityKind | undefined });
  }

  @Post()
  @RequirePermission('attribute_definitions.manage')
  @Audited({ action: 'attribute_definition.create', entityType: 'attribute_definition' })
  create(@ZodBody(attributeDefinitionInput) body: z.infer<typeof attributeDefinitionInput>) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @RequirePermission('attribute_definitions.manage')
  @Audited({ action: 'attribute_definition.update', entityType: 'attribute_definition', entityIdParam: 'id' })
  update(@Param('id') id: string, @ZodBody(patchSchema) body: z.infer<typeof patchSchema>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('attribute_definitions.manage')
  @Audited({ action: 'attribute_definition.archive', entityType: 'attribute_definition', entityIdParam: 'id' })
  archive(@Param('id') id: string) {
    return this.svc.archive(id);
  }
}
