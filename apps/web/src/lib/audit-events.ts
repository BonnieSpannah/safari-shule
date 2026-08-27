import { postClientAuditEvents, type ClientAuditEvent } from './api/audit';

export function trackClientEvent(event: ClientAuditEvent): void {
  void postClientAuditEvents([event]).catch(() => undefined);
}
