import { z } from 'zod';

export const TRIP_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_DIRECTIONS = ['morning_pickup', 'evening_dropoff'] as const;
export type TripDirection = (typeof TRIP_DIRECTIONS)[number];

export interface Trip {
  id: string;
  tenantId: string;
  routeId: string;
  vehicleId: string;
  driverUserId: string;
  assistantUserId: string | null;
  scheduledStart: string;
  startedAt: string | null;
  endedAt: string | null;
  status: TripStatus;
  direction: TripDirection;
}

export const tripLocationInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKph: z.number().min(0).max(250),
  headingDeg: z.number().min(0).max(360),
  recordedAt: z.string(),
});
export type TripLocationInput = z.infer<typeof tripLocationInput>;
