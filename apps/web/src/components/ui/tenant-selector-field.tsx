import { useQuery } from '@tanstack/react-query';
import { usePermission } from '@/hooks/usePermission';
import { listTenants } from '@/lib/api/tenants';
import { FormField } from './form-field';

interface TenantSelectorFieldProps {
  /** react-hook-form register result or value+onChange pair */
  value: string;
  onChange: (id: string) => void;
  error?: string;
  /** When true, renders a read-only badge (for tenant users editing their own data) */
  readOnly?: boolean;
}

/**
 * Renders a tenant dropdown ONLY for system admins.
 * Regular tenant users see nothing — their tenant is implicit from the JWT.
 */
export function TenantSelectorField({ value, onChange, error }: TenantSelectorFieldProps) {
  const isSuperAdmin = usePermission('tenants.manage');

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: listTenants,
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) return null;

  return (
    <FormField label="Tenant / School" required error={error}>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select a tenant —</option>
        {tenants
          .filter((t) => t.status === 'active')
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </select>
    </FormField>
  );
}
