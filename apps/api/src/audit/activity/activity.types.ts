import type { ActivityChannel } from '@prisma/client';

export type { ActivityChannel };

export type ActivityAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'password_change'
  | 'board_student'
  | 'alight_student'
  | 'sos'
  | 'export'
  | 'notification_sent'
  | (string & {});

export interface ActivityRecordInput {
  tenantId: string; // Required - enforces tenant scoping invariant
  actorUserId?: string | null;
  channel: ActivityChannel;
  action: ActivityAction;
  resourceType?: string | null;
  resourceId?: string | null;
  occurredAt?: Date;
  requestId?: string | null;
  traceId?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  sourceType?: string | null;
  sourceId?: string | null;
}
