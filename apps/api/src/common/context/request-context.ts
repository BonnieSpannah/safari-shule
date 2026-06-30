import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  tenantId: string | null;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  bypassTenantScope: boolean;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function requireTenantId(): string {
  const ctx = requestContext.getStore();
  if (!ctx?.tenantId) throw new Error('Tenant context unavailable for the current request.');
  return ctx.tenantId;
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContext.run(ctx, fn);
}

export function runWithBypass<T>(fn: () => Promise<T>): Promise<T> {
  const current = requestContext.getStore();
  const next: RequestContext = current
    ? { ...current, bypassTenantScope: true }
    : {
        requestId: 'system',
        tenantId: null,
        userId: null,
        ip: null,
        userAgent: null,
        bypassTenantScope: true,
      };
  return requestContext.run(next, fn);
}
