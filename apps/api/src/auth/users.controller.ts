import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { paginationQuery } from '@safari-shule/shared-types';
import { RequirePermission } from '../rbac/permission.decorators';
import { ZodQuery } from '../common/validation/zod-pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginated, buildPagination } from '../common/pagination/pagination';
import { requireTenantId } from '../common/context/request-context';
import { runWithBypass } from '../common/context/request-context';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('roles.view')
  async list(@ZodQuery(paginationQuery.extend({ status: z.string().optional() })) q: z.infer<typeof paginationQuery> & { status?: string }) {
    const tenantId = requireTenantId();
    const where: any = { tenantId };
    if (q.q) {
      where.OR = [
        { fullName: { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.status) where.status = q.status;

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        ...buildPagination(q),
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneE164: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          mustChangePassword: true,
          userRoles: {
            select: { role: { select: { key: true, label: true } } },
          },
        },
      }),
    ]);
    return paginated(data, total, q);
  }

  @Get(':id/status')
  @RequirePermission('roles.manage')
  async getStatus() {
    // placeholder — status changes go through a PATCH endpoint
    return {};
  }
}
