DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  SELECT "tenantId", "vehicleId", COUNT(*) AS active_count
  INTO duplicate_record
  FROM "trips"
  WHERE "status" = 'in_progress'::"TripStatus"
  GROUP BY "tenantId", "vehicleId"
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot add one-active-trip-per-vehicle invariant: tenant %, vehicle % has % active trips',
      duplicate_record."tenantId",
      duplicate_record."vehicleId",
      duplicate_record.active_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "trips_one_active_per_vehicle_idx"
  ON "trips"("tenantId", "vehicleId")
  WHERE "status" = 'in_progress'::"TripStatus";
