import { api } from './client';

export type PlanTier = 'basic' | 'pro' | 'enterprise';
export type TenantStatus = 'pending' | 'active' | 'suspended' | 'deactivated' | 'cancelled' | 'deleted';

export interface Tenant {
  id: string;
  slug: string;
  subdomain: string;
  name: string;
  contactEmail: string;
  contactPhone: string | null;
  status: TenantStatus;
  planTier: PlanTier;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantInput {
  slug: string;
  subdomain: string;
  name: string;
  contactEmail: string;
  contactPhone?: string;
  planTier: PlanTier;
  initialAdmin: {
    email: string;
    fullName: string;
    phone?: string;
    password: string;
  };
}

export interface CreateTenantResponse {
  tenant: Tenant;
  adminUser: { id: string; email: string };
}

export interface UpdateTenantInput {
  name?: string;
  contactEmail?: string;
  contactPhone?: string | null;
  planTier?: PlanTier;
}

export async function listTenants(): Promise<Tenant[]> {
  const { data } = await api.get<Tenant[]>('/v1/admin/tenants');
  return data;
}

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResponse> {
  const { data } = await api.post<CreateTenantResponse>('/v1/admin/tenants', input);
  return data;
}

export async function updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant> {
  const { data } = await api.patch<Tenant>(`/v1/admin/tenants/${id}`, input);
  return data;
}

export async function setTenantStatus(
  id: string,
  status: 'active' | 'suspended' | 'deactivated' | 'deleted',
): Promise<Tenant> {
  const { data } = await api.patch<Tenant>(`/v1/admin/tenants/${id}/status`, { status });
  return data;
}
