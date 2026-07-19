import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { ForbiddenPage } from '@/routes/ForbiddenPage';

interface PermissionGateProps {
  /**
   * The user is allowed if they hold AT LEAST ONE of these permissions.
   * Empty array = deny by default.
   */
  anyOf: readonly string[];
  children: ReactNode;
}

export function PermissionGate({ anyOf, children }: PermissionGateProps) {
  const user = useAuthStore((s) => s.user);
  const perms = new Set(user?.permissions ?? []);
  const allowed = anyOf.some((p) => perms.has(p));
  if (!allowed) return <ForbiddenPage requiredPermissions={anyOf} />;
  return <>{children}</>;
}
