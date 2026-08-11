import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap, tap } from 'rxjs';
import { AUDIT_METADATA, type AuditedMeta } from './audit.decorators';
import { AuditService } from './audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithBypass } from '../common/context/request-context';

// Maps entityType string → Prisma client accessor name
const PRISMA_MODEL: Record<string, string> = {
  student: 'student',
  staff: 'staff',
  parent: 'parent',
  caretaker: 'caretaker',
  vehicle: 'vehicle',
  route: 'route',
  trip: 'trip',
  tenant: 'tenant',
  user: 'user',
  rfid_device: 'rfidDevice',
  invitation: 'invitation',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const meta = this.reflector.getAllAndOverride<AuditedMeta | undefined>(AUDIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const entityId = meta.entityIdParam ? req.params?.[meta.entityIdParam] : undefined;

    // Optionally fetch the current state before the mutation runs
    const before$ = from(
      meta.fetchBefore && entityId && PRISMA_MODEL[meta.entityType]
        ? runWithBypass(() =>
            (this.prisma as any)[PRISMA_MODEL[meta.entityType]!].findFirst({ where: { id: entityId } }),
          ).catch(() => null)
        : Promise.resolve(null),
    );

    return before$.pipe(
      switchMap((before) =>
        next.handle().pipe(
          tap((result) => {
            const safeAfter =
              meta.redactFields && typeof result === 'object' && result
                ? Object.fromEntries(
                    Object.entries(result as Record<string, unknown>).filter(
                      ([k]) => !meta.redactFields!.includes(k),
                    ),
                  )
                : result;
            void this.audit.record({
              action: meta.action,
              entityType: meta.entityType,
              entityId: entityId ?? (typeof result === 'object' && result && 'id' in (result as any) ? String((result as any).id) : null),
              before: before ?? null,
              after: safeAfter ?? null,
            });
          }),
        ),
      ),
    );
  }
}

