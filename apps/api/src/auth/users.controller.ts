import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { paginationQuery } from '@safari-shule/shared-types';
import { RequirePermission } from '../rbac/permission.decorators';
import { RbacService } from '../rbac/rbac.service';
import { ZodQuery } from '../common/validation/zod-pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginated, buildPagination } from '../common/pagination/pagination';
import { requireTenantId, runWithBypass } from '../common/context/request-context';
import { resolveTenantScope } from '../common/tenant/tenant-scope';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService, private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('roles.view')
  async list(
    @Req() req: Request,
    @ZodQuery(paginationQuery.extend({ status: z.string().optional(), tenantId: z.string().uuid().optional(), roleKey: z.string().optional() })) q: z.infer<typeof paginationQuery> & { status?: string; tenantId?: string; roleKey?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const tenantId = scope.tenantId ?? requireTenantId();
    const run = () => {
      const where: any = { tenantId };
      if (q.q) {
        where.OR = [
          { fullName: { contains: q.q, mode: 'insensitive' } },
          { email: { contains: q.q, mode: 'insensitive' } },
        ];
      }
      if (q.status) where.status = q.status;
      if (q.roleKey) where.userRoles = { some: { role: { key: q.roleKey } } };

      return Promise.all([
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
      ]).then(([total, data]) => paginated(data, total, q));
    };
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get(':id/status')
  @RequirePermission('roles.manage')
  async getStatus() {
    // placeholder — status changes go through a PATCH endpoint
    return {};
  }
}
