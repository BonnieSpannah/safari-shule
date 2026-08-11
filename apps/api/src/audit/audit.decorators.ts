import { SetMetadata } from '@nestjs/common';

export interface AuditedMeta {
  action: string;
  entityType: string;
  entityIdParam?: string;
  fetchBefore?: boolean;
  /** Fields to strip from the 'after' snapshot — use for responses that contain plain credentials. */
  redactFields?: string[];
}

export const AUDIT_METADATA = 'safari.audit';
export const Audited = (meta: AuditedMeta) => SetMetadata(AUDIT_METADATA, meta);
