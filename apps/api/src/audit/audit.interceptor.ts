import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_METADATA, type AuditedMeta } from './audit.decorators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const meta = this.reflector.getAllAndOverride<AuditedMeta | undefined>(AUDIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const entityId = meta.entityIdParam ? req.params?.[meta.entityIdParam] : undefined;

    return next.handle().pipe(
      tap((result) => {
        void this.audit.record({
          action: meta.action,
          entityType: meta.entityType,
          entityId: entityId ?? (typeof result === 'object' && result && 'id' in (result as any) ? String((result as any).id) : null),
          after: result ?? null,
        });
      }),
    );
  }
}
