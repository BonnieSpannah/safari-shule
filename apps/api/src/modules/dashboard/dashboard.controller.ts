import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireTenantId, runWithBypass } from '../../common/context/request-context';
import { RequirePermission } from '../../rbac/permission.decorators';
import { RbacService } from '../../rbac/rbac.service';
import { resolveTenantScope } from '../../common/tenant/tenant-scope';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService, private readonly rbac: RbacService) {}

  @Get('stats')
  @RequirePermission('dashboard.view')
  async stats(@Req() req: Request) {
    const scope = await resolveTenantScope(this.rbac, req, undefined);
    const effectiveTenantId = scope.tenantId ?? (scope.isSuperAdmin ? undefined : requireTenantId());
    const where = effectiveTenantId ? { tenantId: effectiveTenantId } : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const run = () => Promise.all([
      this.prisma.user.count({ where: { ...where, status: 'active' } }),
      this.prisma.student.count({ where }),
      this.prisma.staff.count({ where }),
      this.prisma.vehicle.count({ where: { ...where, status: 'active' } }),
      this.prisma.route.count({ where: { ...where, isActive: true } }),
      this.prisma.trip.count({ where: { ...where, scheduledStart: { gte: today, lt: tomorrow } } }),
      this.prisma.incident.count({ where: { ...where, status: { in: ['reported', 'acknowledged'] } } }),
    ]);

    const [users, students, staff, vehicles, routes, tripsToday, incidentsOpen] =
      scope.isSuperAdmin ? await runWithBypass(run) : await run();

    return { users, students, staff, vehicles, routes, tripsToday, incidentsOpen };
  }
}
