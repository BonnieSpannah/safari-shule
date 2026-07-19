-- M2.5 Identity & Lifecycle — Phase A: enum values only
-- ALTER TYPE ... ADD VALUE cannot share a transaction with usage of the new value.
-- We add all new enum values here; Phase B (0004) then USES them.

ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'inactive';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'deactivated';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'deleted';

DO $$ BEGIN
  CREATE TYPE "TenantStatus" AS ENUM ('pending', 'active', 'suspended', 'deactivated', 'cancelled', 'deleted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
