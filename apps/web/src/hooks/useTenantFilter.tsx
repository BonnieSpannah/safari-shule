import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import React from 'react';
import { usePermission } from './usePermission';
import { listTenants, type Tenant } from '@/lib/api/tenants';

/**
 * Returns tenant filter state + UI helpers for pages that expose a
 * cross-tenant view to system admins.
 */
export function useTenantFilter() {
  const isSuperAdmin = usePermission('tenants.manage');

  const tenantsQuery = useQuery({
    queryKey: ['tenants'],
    queryFn: listTenants,
    enabled: isSuperAdmin,
  });
  const tenants: Tenant[] = tenantsQuery.data ?? [];

  return { isSuperAdmin, tenants };
}

/**
 * Renders a tenant-name badge for use in table cells.
 * Returns null for non-super-admin views (tenant is always own).
 */
export function TenantBadge({ tenant }: { tenant?: { name: string } | null }) {
  if (!tenant) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Building2 className="h-3 w-3" />
      {tenant.name}
    </span>
  );
}

/**
 * Dropdown to filter by tenant. Only rendered when `isSuperAdmin` is true.
 */
export function TenantFilterSelect({
  tenants,
  value,
  onChange,
}: {
  tenants: Tenant[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All tenants</option>
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
