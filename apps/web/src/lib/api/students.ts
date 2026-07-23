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
}

export interface ListStudentsResponse {
  data: Student[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export async function listStudents(params?: { q?: string; classroom?: string; gender?: string; page?: number; pageSize?: number }): Promise<ListStudentsResponse> {
  const { data } = await api.get<ListStudentsResponse>('/v1/students', { params });
  return data;
}

export async function getStudent(id: string): Promise<Student> {
  const { data } = await api.get<Student>(`/v1/students/${id}`);
  return data;
}

export async function createStudent(input: StudentInput): Promise<Student> {
  const { data } = await api.post<Student>('/v1/students', input);
  return data;
}

export async function updateStudent(id: string, input: Partial<StudentInput>): Promise<Student> {
  const { data } = await api.patch<Student>(`/v1/students/${id}`, input);
  return data;
}

export async function deleteStudent(id: string): Promise<void> {
  await api.delete(`/v1/students/${id}`);
}

export async function getStudent(id: string): Promise<Student> {
  const { data } = await api.get<Student>(`/v1/students/${id}`);
  return data;
}

export async function createStudent(input: StudentInput): Promise<Student> {
  const { data } = await api.post<Student>('/v1/students', input);
  return data;
}

export async function updateStudent(id: string, input: Partial<StudentInput>): Promise<Student> {
  const { data } = await api.patch<Student>(`/v1/students/${id}`, input);
  return data;
}

export async function deleteStudent(id: string): Promise<void> {
  await api.delete(`/v1/students/${id}`);
}
