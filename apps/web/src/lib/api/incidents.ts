import { api } from './client';

export interface Incident {
  id: string;
  tenantId: string;
  tripId: string;
  kind: string;
  severity: string;
  status: 'reported' | 'acknowledged' | 'resolved';
  description: string | null;
  occurredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  trip?: {
    id: string;
    route?: { id: string; name: string } | null;
    vehicle?: { id: string; registration: string } | null;
  } | null;
}

export interface IncidentNotificationMessage {
  id: string;
  to: string;
  status: string;
  error: string | null;
  providerMessageId: string | null;
  createdAt: string;
}

export interface IncidentNotificationsResponse {
  incidentId: string;
  messages: IncidentNotificationMessage[];
}

export interface ListIncidentsResponse {
  data: Incident[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export async function listIncidents(params?: {
  q?: string;
  status?: string;
  tripId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListIncidentsResponse> {
  const { data } = await api.get<ListIncidentsResponse>('/v1/incidents', { params });
  return data;
}

export async function acknowledgeIncident(id: string): Promise<Incident> {
  const { data } = await api.post<Incident>(`/v1/incidents/${id}/acknowledge`);
  return data;
}

export async function resolveIncident(id: string, resolution: string): Promise<Incident> {
  const { data } = await api.post<Incident>(`/v1/incidents/${id}/resolve`, { resolution });
  return data;
}

export async function getIncident(id: string): Promise<Incident> {
  const { data } = await api.get<Incident>(`/v1/incidents/${id}`);
  return data;
}

export async function listIncidentNotifications(id: string): Promise<IncidentNotificationsResponse> {
  const { data } = await api.get<IncidentNotificationsResponse>(`/v1/incidents/${id}/notifications`);
  return data;
}
