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
}

export async function listUsers(params?: { q?: string; status?: string; page?: number; pageSize?: number }): Promise<ListUsersResponse> {
  const { data } = await api.get<ListUsersResponse>('/v1/users', { params });
  return data;
}

export async function inviteUser(input: InviteUserInput): Promise<void> {
  await api.post('/v1/invitations', {
    email: input.email,
    fullName: input.fullName,
    phone: input.phone || undefined,
    roleKeys: input.roleKeys,
  });
}

export async function deactivateUser(id: string): Promise<void> {
  await api.patch(`/v1/users/${id}/status`, { status: 'suspended' });
}

export async function activateUser(id: string): Promise<void> {
  await api.patch(`/v1/users/${id}/status`, { status: 'active' });
}

export async function inviteUser(input: InviteUserInput): Promise<void> {
  await api.post('/v1/invitations', {
    email: input.email,
    fullName: input.fullName,
    phone: input.phone || undefined,
    roleKeys: input.roleKeys,
  });
}

export async function deactivateUser(id: string): Promise<void> {
  await api.patch(`/v1/users/${id}/status`, { status: 'suspended' });
}

export async function activateUser(id: string): Promise<void> {
  await api.patch(`/v1/users/${id}/status`, { status: 'active' });
}
