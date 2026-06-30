import { z } from 'zod';

export const VEHICLE_STATUSES = ['active', 'maintenance', 'retired'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_OWNERSHIP = ['school', 'hired'] as const;
export type VehicleOwnership = (typeof VEHICLE_OWNERSHIP)[number];

export const kraRegistration = z
  .string()
  .trim()
  .regex(/^K[A-Z]{2}\s?\d{3}[A-Z]$/i, 'Must be a Kenyan plate (e.g. KCB 123X)');

export const vehicleInput = z.object({
  registration: kraRegistration,
  make: z.string().min(1).max(40),
  model: z.string().min(1).max(40),
  year: z.number().int().min(1980).max(2100),
  capacity: z.number().int().min(1).max(120),
  ownership: z.enum(VEHICLE_OWNERSHIP),
  status: z.enum(VEHICLE_STATUSES).default('active'),
  assignedDriverId: z.string().uuid().nullable().optional(),
  assignedAssistantId: z.string().uuid().nullable().optional(),
  odometerKm: z.number().int().min(0).default(0),
});
export type VehicleInput = z.infer<typeof vehicleInput>;

export const fuelLogInput = z.object({
  vehicleId: z.string().uuid(),
  driverUserId: z.string().uuid(),
  liters: z.number().positive(),
  costKes: z.number().int().positive(),
  station: z.string().min(1).max(80),
  odometerKm: z.number().int().min(0),
  occurredAt: z.string(),
});
export type FuelLogInput = z.infer<typeof fuelLogInput>;

export const repairLogInput = z.object({
  vehicleId: z.string().uuid(),
  reportedByUserId: z.string().uuid(),
  description: z.string().min(3).max(500),
  vendor: z.string().min(1).max(80),
  costKes: z.number().int().positive(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type RepairLogInput = z.infer<typeof repairLogInput>;

export const insuranceInput = z.object({
  vehicleId: z.string().uuid(),
  provider: z.string().min(1).max(80),
  policyNumber: z.string().min(1).max(40),
  premiumKes: z.number().int().positive(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documentUrl: z.string().url().nullable().optional(),
});
export type InsuranceInput = z.infer<typeof insuranceInput>;

export const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export type LatLng = z.infer<typeof latLng>;

export const busStopInput = z.object({
  name: z.string().min(1).max(80),
  location: latLng,
  pickupOrder: z.number().int().min(0),
  scheduledPickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  scheduledDropoffTime: z.string().regex(/^\d{2}:\d{2}$/),
});
export type BusStopInput = z.infer<typeof busStopInput>;

export const GEOFENCE_KINDS = ['route_corridor', 'school_zone', 'restricted'] as const;
export type GeofenceKind = (typeof GEOFENCE_KINDS)[number];

export const geofenceInput = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(GEOFENCE_KINDS),
  polygon: z.array(latLng).min(3),
  routeId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
});
export type GeofenceInput = z.infer<typeof geofenceInput>;

export const routeInput = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  startPoint: latLng,
  endPoint: latLng,
  isActive: z.boolean().default(true),
  busStops: z.array(busStopInput).min(1),
});
export type RouteInput = z.infer<typeof routeInput>;
