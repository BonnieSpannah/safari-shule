import { Controller, Get, Param, Patch, Post, Put, Req, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import {
  routeInput,
  geofenceInput,
  studentRouteAssignmentInput,
  paginationQuery,
} from '@safari-shule/shared-types';
import { RequirePermission } from '../../rbac/permission.decorators';
import { RbacService } from '../../rbac/rbac.service';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../common/validation/zod-pipe';
import { runWithBypass } from '../../common/context/request-context';
import { resolveTenantScope } from '../../common/tenant/tenant-scope';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@Controller()
export class RoutesController {
  constructor(private readonly svc: RoutesService, private readonly rbac: RbacService) {}

  @Get('routes')
  @RequirePermission('routes.view')
  async list(
    @Req() req: Request,
    @ZodQuery(paginationQuery.extend({ isActive: z.string().optional(), tenantId: z.string().uuid().optional() })) q: z.infer<typeof paginationQuery> & { isActive?: string; tenantId?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const run = () => this.svc.listRoutes({ ...q, scopeTenantId: scope.tenantId });
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get('routes/:id')
  @RequirePermission('routes.view')
  one(@Param('id') id: string) {
    return this.svc.getRoute(id);
  }

  @Post('routes')
  @RequirePermission('routes.manage')
  @Audited({ action: 'route.create', entityType: 'route' })
  create(
    @ZodBody(routeInput.extend({ targetTenantId: z.string().uuid().optional() })) body: z.infer<typeof routeInput> & { targetTenantId?: string },
  ) {
    return this.svc.createRoute(body);
  }

  @Patch('routes/:id')
  @RequirePermission('routes.manage')
  @Audited({ action: 'route.update', entityType: 'route', entityIdParam: 'id' })
  async patch(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string | null; isActive?: boolean; targetTenantId?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, body.targetTenantId);
    const run = () => this.svc.patchRoute(id, body);
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get('routes/:id/stops')
  @RequirePermission('routes.view')
  stops(@Param('id') id: string) {
    return this.svc.getRouteStops(id);
  }

  @Get('routes/:id/assignments')
  @RequirePermission('routes.view')
  assignments(@Param('id') id: string) {
    return this.svc.listAssignmentsForRoute(id);
  }

  @Put('routes/:id/stops')
  @RequirePermission('routes.manage')
  @Audited({ action: 'route.stops_updated', entityType: 'route', entityIdParam: 'id' })
  replaceStops(@Param('id') id: string, @Body() body: { stops: { name: string; lat: number; lng: number; pickupOrder: number; scheduledPickupTime: string; scheduledDropoffTime: string }[] }) {
    return this.svc.replaceRouteStops(id, body.stops ?? []);
  }

  @Post('geofences')
  @RequirePermission('geofences.manage')
  @Audited({ action: 'geofence.create', entityType: 'geofence' })
  geofence(@ZodBody(geofenceInput) body: z.infer<typeof geofenceInput>) {
    return this.svc.createGeofence(body);
  }

  @Post('student-route-assignments')
  @RequirePermission('routes.manage')
  @Audited({ action: 'route.assign', entityType: 'student_route_assignment' })
  assign(@ZodBody(studentRouteAssignmentInput) body: z.infer<typeof studentRouteAssignmentInput>) {
    return this.svc.assignStudentToRoute(body);
  }
}
