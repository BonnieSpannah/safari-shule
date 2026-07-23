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
  activatedAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  restoredAt: string | null;
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

export interface TenantUser {
  id: string;
  email: string;
  fullName: string;
  phoneE164?: string | null;
  status: string;
  createdAt: string;
  lastLoginAt?: string | null;
  userRoles: { role: { key: string; label: string } }[];
}

export interface TenantStudent {
  id: string;
  legalName: string;
  admissionNumber: string;
  classroom: string | null;
  gender: string;
  dateOfBirth: string;
  createdAt: string;
  parents: { relation: string; parent: { legalName: string; phoneE164: string } }[];
}

export interface TenantStaff {
  id: string;
  legalName: string;
  employeeNumber: string;
  position: string;
  phoneE164: string;
  email: string | null;
  gender: string;
  createdAt: string;
}

export interface TenantVehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number;
  capacity: number;
  ownership: string;
  status: string;
  createdAt: string;
}

export interface TenantRoute {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { busStops: number; studentAssignments: number };
  assignments: { vehicle: { make: string; model: string; registration: string } }[];
}

export interface TenantDetail extends Tenant {
  _count: {
    users: number;
    staff: number;
    students: number;
    vehicles: number;
    routes: number;
  };
  users: TenantUser[];
  students: TenantStudent[];
  staff: TenantStaff[];
  vehicles: TenantVehicle[];
  routes: TenantRoute[];
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

export async function getTenantDetail(id: string): Promise<TenantDetail> {
  const { data } = await api.get<TenantDetail>(`/v1/admin/tenants/${id}`);
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
