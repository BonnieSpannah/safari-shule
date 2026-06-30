export const NOTIFICATION_CHANNELS = ['sms', 'email', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'quota_exceeded',
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const TEMPLATE_IDS = [
  'student.boarded',
  'student.alighted',
  'invitation',
  'parent.otp',
  'sos.alert',
  'mpesa.receipt',
  'monthly.statement',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface OutboundMessage {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  to: string;
  templateId: TemplateId;
  status: NotificationStatus;
  providerMessageId: string | null;
  costCents: number | null;
  error: string | null;
  createdAt: string;
}
