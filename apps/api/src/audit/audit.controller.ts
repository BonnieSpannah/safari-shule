import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { paginationQuery } from '@safari-shule/shared-types';
import { RequirePermission } from '../rbac/permission.decorators';
import { ZodQuery } from '../common/validation/zod-pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { paginated, buildPagination } from '../common/pagination/pagination';
import { requireTenantId, runWithBypass } from '../common/context/request-context';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  @Get()
  @RequirePermission('audit.view')
  async list(
    @Req() req: Request,
    @ZodQuery(paginationQuery.extend({
      action: z.string().optional(),
      entityType: z.string().optional(),
      actorUserId: z.string().uuid().optional(),
      /** System admins may pass this to drill into a specific tenant. */
      tenantId: z.string().uuid().optional(),
    })) q: z.infer<typeof paginationQuery> & { action?: string; entityType?: string; actorUserId?: string; tenantId?: string },
  ) {
    const jwtUser = (req as any).user as { userId: string; tenantId: string };
    const perms = await this.rbac.getUserPermissions(jwtUser.tenantId, jwtUser.userId);
    const isSuperAdmin = perms.has('tenants.manage');

    const scopedTenantId = isSuperAdmin
      ? (q.tenantId ?? null)          // super admin: optional tenant filter, null = all
      : requireTenantId();             // tenant user: always scoped to own tenant

    const where: any = {};
    if (scopedTenantId) where.tenantId = scopedTenantId;
    if (q.q) where.action = { contains: q.q, mode: 'insensitive' };
    if (q.action) where.action = q.action;
    if (q.entityType) where.entityType = q.entityType;
    if (q.actorUserId) where.actorUserId = q.actorUserId;

    const query = async () => {
      const [total, data] = await Promise.all([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.findMany({
          where,
          ...buildPagination({ ...q, sort: q.sort ?? 'createdAt:desc' }),
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            before: true,
            after: true,
            ipAddress: true,
            userAgent: true,
            requestId: true,
            createdAt: true,
            actor: { select: { id: true, fullName: true, email: true } },
            tenant: { select: { id: true, name: true, slug: true } },
          },
        }),
      ]);
      return paginated(data, total, q);
    };

    return isSuperAdmin ? runWithBypass(query) : query();
  }
}

