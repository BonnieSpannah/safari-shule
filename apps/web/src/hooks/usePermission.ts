import { useAuthStore } from '@/stores/auth.store';

/**
 * Returns true if the current user has ALL of the listed permissions.
 * Pass a single string for a single-permission check.
 */
export function usePermission(...keys: string[]): boolean {
  const perms = useAuthStore((s) => s.user?.permissions ?? []);
  const set = new Set(perms);
  return keys.every((k) => set.has(k));
}

/**
 * Returns true if the current user has ANY of the listed permissions.
 */
export function useAnyPermission(...keys: string[]): boolean {
  const perms = useAuthStore((s) => s.user?.permissions ?? []);
  const set = new Set(perms);
  return keys.some((k) => set.has(k));
}
