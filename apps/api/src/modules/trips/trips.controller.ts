import { Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import {
  tripInput,
  tripCancelInput,
  paginationQuery,
  TRIP_STATUSES,
} from '@safari-shule/shared-types';
import { RequirePermission } from '../../rbac/permission.decorators';
import { RbacService } from '../../rbac/rbac.service';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../common/validation/zod-pipe';
import { runWithBypass } from '../../common/context/request-context';
import { resolveTenantScope } from '../../common/tenant/tenant-scope';
import { TripsService } from './trips.service';

const listQuery = paginationQuery.extend({
  status: z.enum(TRIP_STATUSES).optional(),
});

const tripAssignmentUpdateInput = z.object({
  vehicleId: z.string().uuid().optional(),
  driverUserId: z.string().uuid().optional(),
  assistantUserId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

function requireAuthenticatedUserId(req: Request): string {
  const user = req.user as { userId?: string } | undefined;
  if (!user?.userId) {
    throw new Error('Authenticated user is unavailable.');
  }
  return user.userId;
}

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly svc: TripsService, private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('trips.view')
  async list(
    @Req() req: Request,
    @ZodQuery(listQuery.extend({ tenantId: z.string().uuid().optional() })) q: z.infer<typeof listQuery> & { tenantId?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const run = () => this.svc.list({ ...q, scopeTenantId: scope.tenantId });
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get(':id')
  @RequirePermission('trips.view')
  one(@Param('id') id: string) {
    return this.svc.byId(id);
  }

  @Patch(':id/assignment')
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.assignment_update', entityType: 'trip', entityIdParam: 'id', fetchBefore: true })
  async updateAssignment(
    @Param('id') id: string,
    @ZodBody(tripAssignmentUpdateInput) body: z.infer<typeof tripAssignmentUpdateInput>,
  ) {
    await this.svc.updateAssignment(id, body);
    const trip = await this.svc.byId(id);
    return {
      ...trip,
      assignmentChange: {
        reason: body.reason ?? null,
        changedAt: new Date().toISOString(),
      },
    };
  }

  @Post()
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.create', entityType: 'trip' })
  create(
    @ZodBody(tripInput.extend({ targetTenantId: z.string().uuid().optional() })) body: z.infer<typeof tripInput> & { targetTenantId?: string },
  ) {
    return this.svc.create(body);
  }

  @Post(':id/start')
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.start', entityType: 'trip', entityIdParam: 'id' })
  start(@Param('id') id: string) {
    return this.svc.start(id);
  }

  @Post(':id/driver-start')
  @RequirePermission('trips.view')
  @Audited({ action: 'trip.start', entityType: 'trip', entityIdParam: 'id' })
  startAsDriver(@Param('id') id: string, @Req() req: Request) {
    return this.svc.startForAssignedDriver(id, requireAuthenticatedUserId(req));
  }

  @Post(':id/end')
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.end', entityType: 'trip', entityIdParam: 'id' })
  end(@Param('id') id: string) {
    return this.svc.end(id);
  }

  @Post(':id/driver-end')
  @RequirePermission('trips.view')
  @Audited({ action: 'trip.end', entityType: 'trip', entityIdParam: 'id' })
  endAsDriver(@Param('id') id: string, @Req() req: Request) {
    return this.svc.endForAssignedDriver(id, requireAuthenticatedUserId(req));
  }

  @Post(':id/cancel')
  @RequirePermission('trips.dispatch')
  @Audited({ action: 'trip.cancel', entityType: 'trip', entityIdParam: 'id' })
  cancel(@Param('id') id: string, @ZodBody(tripCancelInput) body: z.infer<typeof tripCancelInput>) {
    return this.svc.cancel(id, body.reason);
  }
}
