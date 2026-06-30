export type PlanTier = 'basic' | 'pro' | 'enterprise';

export interface Tenant {
  id: string;
  slug: string;
  subdomain: string;
  name: string;
  contactEmail: string;
  planTier: PlanTier;
  createdAt: string;
}

export const FEATURE_KEYS = [
  'mpesa_payments',
  'rfid_ingestion',
  'live_gps',
  'sms_broadcast',
  'email_statements',
  'incident_matrix',
  'parent_otp_login',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface TenantFeature {
  tenantId: string;
  featureKey: FeatureKey;
  enabled: boolean;
  limits: Record<string, number | string | null>;
  expiresAt: string | null;
}
