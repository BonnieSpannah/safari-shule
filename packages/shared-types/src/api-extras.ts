import { z } from 'zod';
import { latLng } from './fleet';
import { TRIP_DIRECTIONS, TRIP_STATUSES } from './trips';

export const tripInput = z.object({
  routeId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  driverUserId: z.string().uuid(),
  assistantUserId: z.string().uuid().nullable().optional(),
  scheduledStart: z.string(),
  direction: z.enum(TRIP_DIRECTIONS),
});
export type TripInput = z.infer<typeof tripInput>;

export const tripCancelInput = z.object({
  reason: z.string().min(2).max(200),
});
export type TripCancelInput = z.infer<typeof tripCancelInput>;

// Re-exported from trips.ts to satisfy callers that import from the index facade.
export { tripLocationInput, TRIP_DIRECTIONS, TRIP_STATUSES } from './trips';

export const studentRouteAssignmentInput = z.object({
  studentId: z.string().uuid(),
  routeId: z.string().uuid(),
  busStopId: z.string().uuid(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});
export type StudentRouteAssignmentInput = z.infer<typeof studentRouteAssignmentInput>;

export const incidentInput = z.object({
  tripId: z.string().uuid(),
  kind: z.enum([
    'sos',
    'traffic',
    'puncture',
    'mechanical',
    'accident',
    'other',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  description: z.string().min(3).max(1000),
  location: latLng.nullable().optional(),
  occurredAt: z.string().datetime().optional(),
});
export type IncidentInput = z.infer<typeof incidentInput>;

export const insuranceRecordInput = z.object({
  vehicleId: z.string().uuid(),
  provider: z.string().min(1).max(80),
  policyNumber: z.string().min(1).max(40),
  premiumKes: z.number().int().positive(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documentUrl: z.string().url().nullable().optional(),
});
export type InsuranceRecordInput = z.infer<typeof insuranceRecordInput>;
