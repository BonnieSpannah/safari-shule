import { api } from './client';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneE164: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  userRoles: { role: { key: string; label: string } }[];
  tenant?: { id: string; name: string; slug: string } | null;
}

export interface ListUsersResponse {
  data: User[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface InviteUserInput {
  email: string;
  fullName: string;
  phone?: string;
  roleKeys: string[];
  targetTenantId?: string;
}

export async function listUsers(params?: { q?: string; status?: string; tenantId?: string; roleKey?: string; page?: number; pageSize?: number }): Promise<ListUsersResponse> {
  const { data } = await api.get<ListUsersResponse>('/v1/users', { params });
  return data;
}

export async function inviteUser(input: InviteUserInput): Promise<void> {
  await api.post('/v1/invitations', {
    email: input.email,
    fullName: input.fullName,
    phone: input.phone || undefined,
    roleKeys: input.roleKeys,
    targetTenantId: input.targetTenantId || undefined,
  });
}

export async function deactivateUser(id: string): Promise<void> {
  await api.patch(`/v1/users/${id}/status`, { status: 'suspended' });
}

export async function activateUser(id: string): Promise<void> {
  await api.patch(`/v1/users/${id}/status`, { status: 'active' });
}

export interface UpdateUserInput {
  fullName?: string;
  phoneE164?: string | null;
  roleKeys?: string[];
  targetTenantId?: string;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const { data } = await api.patch<User>(`/v1/users/${id}`, input);
  return data;
}
