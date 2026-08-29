import { BadRequestException, Controller, Get, NotFoundException, Param, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { paginationQuery } from '@safari-shule/shared-types';
import { RequirePermission } from '../rbac/permission.decorators';
import { RbacService } from '../rbac/rbac.service';
import { ZodBody, ZodQuery } from '../common/validation/zod-pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginated, buildPagination } from '../common/pagination/pagination';
import { requireTenantId, runWithBypass } from '../common/context/request-context';
import { resolveTenantScope } from '../common/tenant/tenant-scope';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phoneE164: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  mustChangePassword: true,
  userRoles: { select: { role: { select: { key: true, label: true } } } },
  tenant: { select: { id: true, name: true, slug: true } },
} as const;

const statusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
});

const editSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phoneE164: z.string().trim().regex(/^\+254[17]\d{8}$/).nullable().optional(),
  roleKeys: z.array(z.string().min(1)).min(1).optional(),
  targetTenantId: z.string().uuid().or(z.literal('')).optional(), // destination tenant (move)
  sourceTenantId: z.string().uuid().or(z.literal('')).optional(), // current tenant (lookup)
});

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService, private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('users.list')
  async list(
    @Req() req: Request,
    @ZodQuery(paginationQuery.extend({
      status: z.string().optional(),
      tenantId: z.string().uuid().optional(),
      roleKey: z.string().optional(),
    })) q: z.infer<typeof paginationQuery> & { status?: string; tenantId?: string; roleKey?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    // null = super admin with no filter → omit tenantId to query across all tenants
    const effectiveTenantId = scope.tenantId ?? (scope.isSuperAdmin ? undefined : requireTenantId());
    const run = () => {
      const where: any = effectiveTenantId ? { tenantId: effectiveTenantId } : {};
      if (q.q) where.OR = [
        { fullName: { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q, mode: 'insensitive' } },
      ];
      if (q.status) where.status = q.status;
      if (q.roleKey) where.userRoles = { some: { role: { key: q.roleKey } } };
      return Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({ where, ...buildPagination(q), select: USER_SELECT }),
      ]).then(([total, data]) => paginated(data, total, q));
    };
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get(':id')
  @RequirePermission('users.view')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const scope = await resolveTenantScope(this.rbac, req, undefined);
    const effectiveTenantId = scope.isSuperAdmin ? undefined : requireTenantId();
    const run = () => this.prisma.user.findFirst({
      where: effectiveTenantId ? { id, tenantId: effectiveTenantId } : { id },
      select: USER_SELECT,
    });
    const user = scope.isSuperAdmin ? await runWithBypass(run) : await run();
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  @Patch(':id')
  @RequirePermission('users.update')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @ZodBody(editSchema) body: z.infer<typeof editSchema>,
  ) {
    // For non-super-admins, restrict to own tenant; super admin can edit any user
    const scope = await resolveTenantScope(this.rbac, req, undefined);

    return runWithBypass(async () => {
      // Inside bypass: look up by id only; add tenant guard for non-super-admins
      const tenantGuard = scope.isSuperAdmin ? {} : { tenantId: requireTenantId() };
      const user = await this.prisma.user.findFirst({ where: { id, ...tenantGuard } });
      if (!user) throw new NotFoundException('User not found.');

      const { roleKeys, targetTenantId, sourceTenantId: _s, ...fields } = body;
      const effectiveTenantId = (targetTenantId || undefined) ?? user.tenantId;

      // Move to new tenant if targetTenantId is explicitly set and differs from current
      if (targetTenantId && targetTenantId !== user.tenantId) {
        if (!scope.isSuperAdmin) throw new BadRequestException('Only super admins can move users between tenants.');
        const targetTenant = await this.prisma.tenant.findUnique({ where: { id: targetTenantId } });
        if (!targetTenant) throw new BadRequestException('Target tenant not found.');
        await this.prisma.userRole.deleteMany({ where: { userId: id } });
        await this.prisma.user.update({ where: { id }, data: { ...fields, tenantId: targetTenantId } });
      } else if (Object.keys(fields).length) {
        await this.prisma.user.update({ where: { id }, data: fields });
      }

      if (roleKeys) {
        const roles = await this.prisma.role.findMany({ where: { tenantId: effectiveTenantId, key: { in: roleKeys } } });
        if (roles.length !== roleKeys.length) throw new BadRequestException('One or more role keys are invalid.');
        await this.prisma.userRole.deleteMany({ where: { userId: id, tenantId: effectiveTenantId } });
        await this.prisma.userRole.createMany({
          data: roles.map((r) => ({ tenantId: effectiveTenantId, userId: id, roleId: r.id })),
        });
      }

      return this.prisma.user.findUniqueOrThrow({ where: { id }, select: USER_SELECT });
    });
  }

  @Patch(':id/status')
  @RequirePermission('users.deactivate')
  async setStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @ZodBody(statusSchema) body: z.infer<typeof statusSchema>,
  ) {
    const scope = await resolveTenantScope(this.rbac, req, undefined);
    const effectiveTenantId = scope.isSuperAdmin ? undefined : requireTenantId();

    return runWithBypass(async () => {
      const user = await this.prisma.user.findFirst({
        where: effectiveTenantId ? { id, tenantId: effectiveTenantId } : { id },
      });
      if (!user) throw new NotFoundException('User not found.');
      return this.prisma.user.update({
        where: { id },
        data: { status: body.status },
        select: USER_SELECT,
      });
    });
  }
}
