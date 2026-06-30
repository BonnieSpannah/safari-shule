import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  incidentInput,
  sosInput,
  paginationQuery,
  INCIDENT_STATUSES,
} from '@safari-shule/shared-types';
import { RequirePermission } from '../../rbac/permission.decorators';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../common/validation/zod-pipe';
import { IncidentsService } from './incidents.service';

const listQuery = paginationQuery.extend({
  status: z.enum(INCIDENT_STATUSES).optional(),
  tripId: z.string().uuid().optional(),
});
const resolveSchema = z.object({ resolution: z.string().min(2).max(500) });

@ApiTags('incidents')
@Controller()
export class IncidentsController {
  constructor(private readonly svc: IncidentsService) {}

  @Get('incidents')
  @RequirePermission('incidents.view')
  list(@ZodQuery(listQuery) q: z.infer<typeof listQuery>) {
    return this.svc.list(q);
  }

  @Post('incidents')
  @RequirePermission('incidents.report')
  @Audited({ action: 'incident.create', entityType: 'incident' })
  create(@ZodBody(incidentInput) body: z.infer<typeof incidentInput>) {
    return this.svc.create(body);
  }

  @Post('incidents/:id/acknowledge')
  @RequirePermission('incidents.acknowledge')
  @Audited({ action: 'incident.acknowledge', entityType: 'incident', entityIdParam: 'id' })
  acknowledge(@Param('id') id: string) {
    return this.svc.acknowledge(id);
  }

  @Post('incidents/:id/resolve')
  @RequirePermission('incidents.resolve')
  @Audited({ action: 'incident.resolve', entityType: 'incident', entityIdParam: 'id' })
  resolve(@Param('id') id: string, @ZodBody(resolveSchema) body: z.infer<typeof resolveSchema>) {
    return this.svc.resolve(id, body.resolution);
  }

  @Post('trips/:id/sos')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('incidents.report')
  @Audited({ action: 'incident.sos', entityType: 'trip', entityIdParam: 'id' })
  sos(@Param('id') id: string, @ZodBody(sosInput) body: z.infer<typeof sosInput>) {
    if (!body.location) {
      return this.svc.sos({ tripId: id, location: { lat: 0, lng: 0 }, description: body.description });
    }
    return this.svc.sos({ tripId: id, location: body.location, description: body.description });
  }
}
