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
}

export interface ListParentsResponse {
  data: Parent[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export async function listParents(params?: { q?: string; page?: number; pageSize?: number }): Promise<ListParentsResponse> {
  const { data } = await api.get<ListParentsResponse>('/v1/parents', { params });
  return data;
}

export async function createParent(input: ParentInput): Promise<Parent> {
  const { data } = await api.post<Parent>('/v1/parents', input);
  return data;
}

export async function updateParent(id: string, input: Partial<ParentInput>): Promise<Parent> {
  const { data } = await api.patch<Parent>(`/v1/parents/${id}`, input);
  return data;
}

export async function deleteParent(id: string): Promise<void> {
  await api.delete(`/v1/parents/${id}`);
}
