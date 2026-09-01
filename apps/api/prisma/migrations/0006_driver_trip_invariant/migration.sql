ALTER TABLE "trips"
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

DO $$
DECLARE
  duplicate_record RECORD;
BEGIN
  SELECT "tenantId", "driverUserId", COUNT(*) AS active_count
  INTO duplicate_record
  FROM "trips"
  WHERE "status" = 'in_progress'
  GROUP BY "tenantId", "driverUserId"
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot add one-active-trip invariant: tenant %, driver % has % active trips',
      duplicate_record."tenantId",
      duplicate_record."driverUserId",
      duplicate_record.active_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "trips_one_active_per_driver_idx"
  ON "trips"("tenantId", "driverUserId")
  WHERE "status" = 'in_progress';
