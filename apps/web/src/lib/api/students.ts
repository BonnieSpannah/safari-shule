import { api } from './client';
import type { StudentInput } from '@safari-shule/shared-types';

export interface Student {
  id: string;
  admissionNumber: string;
  legalName: string;
  classroom: string | null;
  dateOfBirth: string;
  gender: string;
  birthCertificateNumber: string | null;
  flexibleAttributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  tenant?: { id: string; name: string; slug: string } | null;
}

export interface StudentDetail extends Student {
  parents: { parent: { id: string; legalName: string; phoneE164: string; email: string | null } }[];
}

export interface ListStudentsResponse {
  data: Student[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export async function listStudents(params?: { q?: string; classroom?: string; gender?: string; tenantId?: string; page?: number; pageSize?: number }): Promise<ListStudentsResponse> {
  const { data } = await api.get<ListStudentsResponse>('/v1/students', { params });
  return data;
}

export async function getStudent(id: string, tenantId?: string): Promise<StudentDetail> {
  const { data } = await api.get<StudentDetail>(`/v1/students/${id}`, { params: tenantId ? { tenantId } : undefined });
  return data;
}

export async function createStudent(input: StudentInput & { targetTenantId?: string }): Promise<Student> {
  const { data } = await api.post<Student>('/v1/students', input);
  return data;
}

export async function updateStudent(id: string, input: Partial<StudentInput> & { targetTenantId?: string; sourceTenantId?: string }): Promise<Student> {
  const { data } = await api.patch<Student>(`/v1/students/${id}`, input);
  return data;
}

export async function deleteStudent(id: string): Promise<void> {
  await api.delete(`/v1/students/${id}`);
}
