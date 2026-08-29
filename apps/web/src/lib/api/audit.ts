import { api } from './client';

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string } | null;
  tenant?: { id: string; name: string; slug: string } | null;
}

export interface ListAuditResponse {
  data: AuditEntry[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface ClientAuditEvent {
  sessionId?: string;
  kind:
    | 'view'
    | 'print'
    | 'download'
    | 'share'
    | 'copy'
    | 'screenshot_attempt'
    | 'visibility_change'
    | 'idle_start'
    | 'idle_resume'
    | 'geo_change'
    | 'export_generated'
    | 'bulk_action'
    | 'role_switch'
    | 'impersonation_start'
    | 'impersonation_end';
  resource?: string;
  resourceId?: string;
  path?: string;
  traceId?: string;
  deviceFingerprint?: string;
  geoHint?: string;
  payload?: Record<string, unknown>;
}

export async function listAuditLogs(params?: { q?: string; action?: string; entityType?: string; entityId?: string; tenantId?: string; page?: number; pageSize?: number }): Promise<ListAuditResponse> {
  const { data } = await api.get<ListAuditResponse>('/v1/audit', { params });
  return data;
}

export async function postClientAuditEvents(events: ClientAuditEvent[]): Promise<{ accepted: number }> {
  const { data } = await api.post<{ accepted: number }>('/v1/audit/events', { events });
  return data;
}
