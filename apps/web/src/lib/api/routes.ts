import { api } from './client';

export interface Route {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { busStops: number; studentAssignments: number };
  tenant?: { id: string; name: string; slug: string } | null;
}

export interface ListRoutesResponse {
  data: Route[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface CreateRouteInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
  busStops: {
    name: string;
    location: { lat: number; lng: number };
    pickupOrder: number;
    scheduledPickupTime: string;
    scheduledDropoffTime: string;
  }[];
}

export async function listRoutes(params?: { q?: string; isActive?: string; tenantId?: string; page?: number; pageSize?: number }): Promise<ListRoutesResponse> {
  const { data } = await api.get<ListRoutesResponse>('/v1/routes', { params });
  return data;
}

export async function getRoute(id: string): Promise<Route> {
  const { data } = await api.get<Route>(`/v1/routes/${id}`);
  return data;
}

export async function createRoute(input: CreateRouteInput & { targetTenantId?: string }): Promise<Route> {
  const { data } = await api.post<Route>('/v1/routes', input);
  return data;
}

export async function updateRoute(id: string, input: Partial<Pick<CreateRouteInput, 'name' | 'description' | 'isActive'>> & { targetTenantId?: string }): Promise<Route> {
  const { data } = await api.patch<Route>(`/v1/routes/${id}`, input);
  return data;
}
