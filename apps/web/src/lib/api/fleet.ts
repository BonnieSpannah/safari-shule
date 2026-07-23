import { api } from './client';
import type { VehicleInput } from '@safari-shule/shared-types';

export interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number;
  capacity: number;
  ownership: 'school' | 'hired';
  status: 'active' | 'maintenance' | 'retired';
  odometerKm: number;
  assignedDriverId: string | null;
  assignedAssistantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListVehiclesResponse {
  data: Vehicle[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export async function listVehicles(params?: { q?: string; status?: string; ownership?: string; page?: number; pageSize?: number }): Promise<ListVehiclesResponse> {
  const { data } = await api.get<ListVehiclesResponse>('/v1/vehicles', { params });
  return data;
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const { data } = await api.get<Vehicle>(`/v1/vehicles/${id}`);
  return data;
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const { data } = await api.post<Vehicle>('/v1/vehicles', input);
  return data;
}

export async function updateVehicle(id: string, input: Partial<VehicleInput>): Promise<Vehicle> {
  const { data } = await api.patch<Vehicle>(`/v1/vehicles/${id}`, input);
  return data;
}

export async function deleteVehicle(id: string): Promise<void> {
  await api.delete(`/v1/vehicles/${id}`);
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const { data } = await api.get<Vehicle>(`/v1/vehicles/${id}`);
  return data;
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const { data } = await api.post<Vehicle>('/v1/vehicles', input);
  return data;
}

export async function updateVehicle(id: string, input: Partial<VehicleInput>): Promise<Vehicle> {
  const { data } = await api.patch<Vehicle>(`/v1/vehicles/${id}`, input);
  return data;
}

export async function deleteVehicle(id: string): Promise<void> {
  await api.delete(`/v1/vehicles/${id}`);
}
