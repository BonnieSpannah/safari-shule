import { Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { paginationQuery } from '@safari-shule/shared-types';
import { RequirePermission } from '../rbac/permission.decorators';
import { ZodBody, ZodQuery } from '../common/validation/zod-pipe';
import { PrismaService } from '../common/prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { paginated, buildPagination } from '../common/pagination/pagination';
import { getContext, requireTenantId, runWithBypass } from '../common/context/request-context';

const clientEventSchema = z.object({
  sessionId: z.string().max(120).optional(),
  kind: z.enum([
    'view',
    'print',
    'download',
    'share',
    'copy',
    'screenshot_attempt',
    'visibility_change',
    'idle_start',
    'idle_resume',
    'geo_change',
    'export_generated',
    'bulk_action',
    'role_switch',
    'impersonation_start',
    'impersonation_end',
  ]),
  resource: z.string().max(120).optional(),
  resourceId: z.string().max(120).optional(),
  path: z.string().max(300).optional(),
  traceId: z.string().max(120).optional(),
  deviceFingerprint: z.string().max(120).optional(),
  geoHint: z.string().max(120).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const clientEventBatchSchema = z.object({
  events: z.array(clientEventSchema).min(1).max(100),
});

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestClientEvents(@Req() req: Request, @ZodBody(clientEventBatchSchema) body: z.infer<typeof clientEventBatchSchema>) {
    const tenantId = requireTenantId();
    const ctx = getContext();
    const ipAddress = req.ip ?? null;
    const userAgent = req.get('user-agent') ?? null;

    await this.prisma.clientEvent.createMany({
      data: body.events.map((event) => ({
        tenantId,
        userId: ctx?.userId ?? null,
        sessionId: event.sessionId ?? null,
        kind: event.kind as any,
        resource: event.resource ?? null,
        resourceId: event.resourceId ?? null,
        path: event.path ?? null,
        traceId: event.traceId ?? null,
        ipAddress,
        userAgent,
        deviceFingerprint: event.deviceFingerprint ?? null,
        geoHint: event.geoHint ?? null,
        payload: (event.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
      skipDuplicates: false,
    });

    return { accepted: body.events.length };
  }

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

