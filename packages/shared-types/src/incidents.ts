import { z } from 'zod';

export const INCIDENT_KINDS = ['sos', 'traffic', 'puncture', 'mechanical', 'accident', 'other'] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const INCIDENT_STATUSES = ['reported', 'acknowledged', 'resolved'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const incidentReportInput = z.object({
  tripId: z.string().uuid(),
  kind: z.enum(INCIDENT_KINDS),
  severity: z.enum(INCIDENT_SEVERITIES).default('medium'),
  description: z.string().min(3).max(1000),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
});
export type IncidentReportInput = z.infer<typeof incidentReportInput>;

export const sosInput = z.object({
  tripId: z.string().uuid(),
  description: z.string().max(500).optional(),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
});
export type SosInput = z.infer<typeof sosInput>;
