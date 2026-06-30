import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  tripInput,
  tripCancelInput,
  paginationQuery,
  TRIP_STATUSES,
} from '@safari-shule/shared-types';
import { RequirePermission } from '../../rbac/permission.decorators';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../common/validation/zod-pipe';
import { TripsService } from './trips.service';

const listQuery = paginationQuery.extend({
  status: z.enum(TRIP_STATUSES).optional(),
});

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly svc: TripsService) {}

  @Get()
  @RequirePermission('trips.view')
  list(@ZodQuery(listQuery) q: z.infer<typeof listQuery>) {
    return this.svc.list(q);
  }

  @Get(':id')
  @RequirePermission('trips.view')
  one(@Param('id') id: string) {
    return this.svc.byId(id);
  }

  @Post()
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.create', entityType: 'trip' })
  create(@ZodBody(tripInput) body: z.infer<typeof tripInput>) {
    return this.svc.create(body);
  }

  @Post(':id/start')
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.start', entityType: 'trip', entityIdParam: 'id' })
  start(@Param('id') id: string) {
    return this.svc.start(id);
  }

  @Post(':id/end')
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.end', entityType: 'trip', entityIdParam: 'id' })
  end(@Param('id') id: string) {
    return this.svc.end(id);
  }

  @Post(':id/cancel')
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.cancel', entityType: 'trip', entityIdParam: 'id' })
  cancel(@Param('id') id: string, @ZodBody(tripCancelInput) _body: z.infer<typeof tripCancelInput>) {
    return this.svc.cancel(id);
  }
}
