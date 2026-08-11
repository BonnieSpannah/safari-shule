import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireTenantId } from '../../common/context/request-context';
import { RequirePermission } from '../../rbac/permission.decorators';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  @RequirePermission('dashboard.view')
  async stats() {
    const tenantId = requireTenantId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [users, students, staff, vehicles, routes, tripsToday, incidentsOpen] =
      await Promise.all([
        this.prisma.user.count({ where: { tenantId, status: 'active' } }),
        this.prisma.student.count({ where: { tenantId } }),
        this.prisma.staff.count({ where: { tenantId } }),
        this.prisma.vehicle.count({ where: { tenantId, status: 'active' } }),
        this.prisma.route.count({ where: { tenantId, isActive: true } }),
        this.prisma.trip.count({
          where: {
            tenantId,
            scheduledStart: { gte: today, lt: tomorrow },
          },
        }),
        this.prisma.incident.count({
          where: { tenantId, status: { in: ['reported', 'acknowledged'] } },
        }),
      ]);

    return { users, students, staff, vehicles, routes, tripsToday, incidentsOpen };
  }
}
