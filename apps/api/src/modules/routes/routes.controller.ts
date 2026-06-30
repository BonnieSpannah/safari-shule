import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  routeInput,
  geofenceInput,
  studentRouteAssignmentInput,
} from '@safari-shule/shared-types';
import { RequirePermission } from '../../rbac/permission.decorators';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody } from '../../common/validation/zod-pipe';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@Controller()
export class RoutesController {
  constructor(private readonly svc: RoutesService) {}

  @Get('routes')
  @RequirePermission('routes.view')
  list() {
    return this.svc.listRoutes();
  }

  @Get('routes/:id')
  @RequirePermission('routes.view')
  one(@Param('id') id: string) {
    return this.svc.getRoute(id);
  }

  @Post('routes')
  @RequirePermission('routes.manage')
  @Audited({ action: 'route.create', entityType: 'route' })
  create(@ZodBody(routeInput) body: z.infer<typeof routeInput>) {
    return this.svc.createRoute(body);
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

  @Get('routes/:id/assignments')
  @RequirePermission('routes.view')
  assignments(@Param('id') id: string) {
    return this.svc.listAssignmentsForRoute(id);
  }
}
