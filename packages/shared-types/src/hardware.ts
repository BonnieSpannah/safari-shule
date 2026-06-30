import { z } from 'zod';

export const rfidScanInput = z.object({
  device_id: z.string().min(3).max(64),
  tag_uid: z.string().min(4).max(64),
  timestamp: z.string(),
});
export type RfidScanInput = z.infer<typeof rfidScanInput>;

export const ATTENDANCE_DIRECTIONS = ['boarding', 'alighting'] as const;
export type AttendanceDirection = (typeof ATTENDANCE_DIRECTIONS)[number];

export interface RfidDevice {
  id: string;
  tenantId: string;
  deviceId: string;
  vehicleId: string | null;
  status: 'active' | 'rotating' | 'disabled';
  lastSeenAt: string | null;
}

export interface AttendanceEvent {
  id: string;
  tenantId: string;
  tripId: string;
  studentId: string;
  deviceId: string;
  direction: AttendanceDirection;
  scannedAt: string;
}
