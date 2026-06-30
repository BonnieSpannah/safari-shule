import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getContext, runWithBypass } from '../common/context/request-context';

export interface AuditRecord {
  tenantId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(payload: AuditRecord): Promise<void> {
    const ctx = getContext();
    const tenantId = payload.tenantId ?? ctx?.tenantId ?? null;
    if (!tenantId) {
      this.logger.warn({ payload }, 'audit.record skipped: no tenant context');
      return;
    }
    try {
      await runWithBypass(() =>
        this.prisma.auditLog.create({
          data: {
            tenantId,
            actorUserId: ctx?.userId ?? null,
            action: payload.action,
            entityType: payload.entityType,
            entityId: payload.entityId ?? null,
            before: (payload.before as any) ?? null,
            after: (payload.after as any) ?? null,
            ipAddress: ctx?.ip ?? null,
            userAgent: ctx?.userAgent ?? null,
            requestId: ctx?.requestId ?? null,
          } as any,
        }),
      );
    } catch (err) {
      this.logger.error({ err }, 'audit.record failed');
    }
  }
}
