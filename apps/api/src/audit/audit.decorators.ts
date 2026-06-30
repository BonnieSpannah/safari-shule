import { SetMetadata } from '@nestjs/common';

export interface AuditedMeta {
  action: string;
  entityType: string;
  entityIdParam?: string;
  fetchBefore?: boolean;
}

export const AUDIT_METADATA = 'safari.audit';
export const Audited = (meta: AuditedMeta) => SetMetadata(AUDIT_METADATA, meta);
