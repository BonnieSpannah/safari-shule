import type { Request } from 'express';
import { RbacService } from '../../rbac/rbac.service';
import { requireTenantId } from '../context/request-context';

export interface TenantScope {
  /** null = all tenants (super admin); string = specific tenant */
  tenantId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Resolves the tenant scope for a list endpoint.
 *  - Regular users: always scoped to their own tenant (JWT tid).
 *  - System admins (tenants.manage): no tenant filter unless `requestedTenantId` is supplied.
 */
export async function resolveTenantScope(
  rbac: RbacService,
  req: Request,
  requestedTenantId?: string,
): Promise<TenantScope> {
  const jwtUser = (req as any).user as { userId: string; tenantId: string };
  const perms = await rbac.getUserPermissions(jwtUser.tenantId, jwtUser.userId);
  if (perms.has('tenants.manage')) {
    return { isSuperAdmin: true, tenantId: requestedTenantId ?? null };
  }
  return { isSuperAdmin: false, tenantId: requireTenantId() };
}
