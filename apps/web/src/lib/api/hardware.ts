import { api } from './client';

export interface RfidDevice {
  id: string;
  deviceId: string;
  vehicleId: string | null;
  status: 'active' | 'rotating' | 'disabled';
  lastSeenAt: string | null;
  keyRotatedAt: string | null;
  createdAt: string;
  vehicle: { registration: string; make: string; model: string } | null;
  tenant?: { id: string; name: string; slug: string } | null;
}

export interface ListDevicesResponse {
  data: RfidDevice[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface RegisterDeviceResult {
  id: string;
  deviceId: string;
  apiKey: string;
  hmacSecret: string;
}

export async function listDevices(params?: { q?: string; status?: string; tenantId?: string; page?: number; pageSize?: number }): Promise<ListDevicesResponse> {
  const { data } = await api.get<ListDevicesResponse>('/v1/rfid-devices', { params });
  return data;
}

export async function registerDevice(input: { deviceId: string; vehicleId?: string | null }): Promise<RegisterDeviceResult> {
  const { data } = await api.post<RegisterDeviceResult>('/v1/rfid-devices', input);
  return data;
}

export async function setDeviceStatus(id: string, status: 'active' | 'rotating' | 'disabled'): Promise<void> {
  await api.patch(`/v1/rfid-devices/${id}/status`, { status });
}
