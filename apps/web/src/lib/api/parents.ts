import { api } from './client';
import type { ParentInput } from '@safari-shule/shared-types';

export interface Parent {
  id: string;
  legalName: string;
  phoneE164: string;
  email: string | null;
  gender: string;
  dateOfBirth: string;
  nationalId: string | null;
  occupation: string | null;
  flexibleAttributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  tenant?: { id: string; name: string; slug: string } | null;
  students?: { student: { id: string; legalName: string; admissionNumber: string; classroom: string | null } }[];
}

export interface ListParentsResponse {
  data: Parent[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export async function listParents(params?: { q?: string; tenantId?: string; page?: number; pageSize?: number }): Promise<ListParentsResponse> {
  const { data } = await api.get<ListParentsResponse>('/v1/parents', { params });
  return data;
}

export async function getParent(id: string, tenantId?: string): Promise<Parent> {
  const { data } = await api.get<Parent>(`/v1/parents/${id}`, { params: tenantId ? { tenantId } : undefined });
  return data;
}

export async function linkStudentToParent(parentId: string, studentId: string, relation: string, sourceTenantId?: string): Promise<void> {
  await api.post(`/v1/parents/${parentId}/students`, { studentId, relation, isPrimary: false, sourceTenantId });
}

export async function createParent(input: ParentInput & { targetTenantId?: string }): Promise<Parent> {
  const { data } = await api.post<Parent>('/v1/parents', input);
  return data;
}

export async function updateParent(id: string, input: Partial<ParentInput> & { targetTenantId?: string; sourceTenantId?: string }): Promise<Parent> {
  const { data } = await api.patch<Parent>(`/v1/parents/${id}`, input);
  return data;
}

export async function deleteParent(id: string): Promise<void> {
  await api.delete(`/v1/parents/${id}`);
}
