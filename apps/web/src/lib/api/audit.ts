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

export async function listAuditLogs(params?: { q?: string; action?: string; entityType?: string; tenantId?: string; page?: number; pageSize?: number }): Promise<ListAuditResponse> {
  const { data } = await api.get<ListAuditResponse>('/v1/audit', { params });
  return data;
}
