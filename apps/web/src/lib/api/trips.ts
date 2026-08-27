import { api } from './client';

export interface Trip {
  id: string;
  routeId: string;
  vehicleId: string;
  driverUserId: string;
  assistantUserId: string | null;
  scheduledStart: string;
  startedAt: string | null;
  endedAt: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  direction: 'morning_pickup' | 'evening_dropoff';
  createdAt: string;
  route: { id: string; name: string };
  vehicle: { id: string; registration: string; make: string; model: string };
  tenant?: { id: string; name: string; slug: string } | null;
}

export interface ListTripsResponse {
  data: Trip[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface CreateTripInput {
  routeId: string;
  vehicleId: string;
  driverUserId: string;
  assistantUserId?: string | null;
  scheduledStart: string;
  direction: 'morning_pickup' | 'evening_dropoff';
  targetTenantId?: string;
}

export async function listTrips(params?: { q?: string; status?: string; tenantId?: string; page?: number; pageSize?: number }): Promise<ListTripsResponse> {
  const { data } = await api.get<ListTripsResponse>('/v1/trips', { params });
  return data;
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const { data } = await api.post<Trip>('/v1/trips', input);
  return data;
}

export async function startTrip(id: string): Promise<Trip> {
  const { data } = await api.post<Trip>(`/v1/trips/${id}/start`);
  return data;
}

export async function endTrip(id: string): Promise<Trip> {
  const { data } = await api.post<Trip>(`/v1/trips/${id}/end`);
  return data;
}

export async function cancelTrip(id: string): Promise<Trip> {
  const { data } = await api.post<Trip>(`/v1/trips/${id}/cancel`);
  return data;
}
