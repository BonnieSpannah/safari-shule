import { api } from './client';
import type { StaffInput } from '@safari-shule/shared-types';

export interface StaffMember {
  id: string;
  employeeNumber: string;
  legalName: string;
  position: string;
  phoneE164: string;
  email: string | null;
  gender: string;
  dateOfBirth: string;
  nationalId: string;
  flexibleAttributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ListStaffResponse {
  data: StaffMember[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export async function listStaff(params?: { q?: string; position?: string; gender?: string; page?: number; pageSize?: number }): Promise<ListStaffResponse> {
  const { data } = await api.get<ListStaffResponse>('/v1/staff', { params });
  return data;
}

export async function getStaffMember(id: string): Promise<StaffMember> {
  const { data } = await api.get<StaffMember>(`/v1/staff/${id}`);
  return data;
}

export async function createStaffMember(input: StaffInput): Promise<StaffMember> {
  const { data } = await api.post<StaffMember>('/v1/staff', input);
  return data;
}

export async function updateStaffMember(id: string, input: Partial<StaffInput>): Promise<StaffMember> {
  const { data } = await api.patch<StaffMember>(`/v1/staff/${id}`, input);
  return data;
}

export async function deleteStaffMember(id: string): Promise<void> {
  await api.delete(`/v1/staff/${id}`);
}

export async function getStaffMember(id: string): Promise<StaffMember> {
  const { data } = await api.get<StaffMember>(`/v1/staff/${id}`);
  return data;
}

export async function createStaffMember(input: StaffInput): Promise<StaffMember> {
  const { data } = await api.post<StaffMember>('/v1/staff', input);
  return data;
}

export async function updateStaffMember(id: string, input: Partial<StaffInput>): Promise<StaffMember> {
  const { data } = await api.patch<StaffMember>(`/v1/staff/${id}`, input);
  return data;
}

export async function deleteStaffMember(id: string): Promise<void> {
  await api.delete(`/v1/staff/${id}`);
}
