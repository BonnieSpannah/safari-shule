-- M2.5 Identity & Lifecycle — Phase B: columns, backfills, and new tables

-- 1) Tenant columns
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "contactPhone"  TEXT,
  ADD COLUMN IF NOT EXISTS "status"        "TenantStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "activatedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt"     TIMESTAMP(3);

UPDATE "tenants"
   SET "activatedAt" = COALESCE("activatedAt", "createdAt")
 WHERE "activatedAt" IS NULL;

-- 1b) refresh_tokens session metadata
ALTER TABLE "refresh_tokens"
  ADD COLUMN IF NOT EXISTS "ipAddress"  TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent"  TEXT,
  ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);

-- 2) User columns
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "passwordUpdatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "activatedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deactivatedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedLoginCount"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "preferences"        JSONB;

UPDATE "users"
   SET "activatedAt" = COALESCE("activatedAt", "createdAt")
 WHERE status = 'active' AND "activatedAt" IS NULL;

-- Migrate legacy 'invited' → 'pending'
UPDATE "users" SET status = 'pending' WHERE status = 'invited';

ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending';

-- 3) password_history
CREATE TABLE IF NOT EXISTS "password_history" (
    "id"              UUID NOT NULL,
    "tenantId"        UUID NOT NULL,
    "userId"          UUID NOT NULL,
    "passwordHash"    TEXT NOT NULL,
    "changedByUserId" UUID,
    "reason"          TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "password_history_tenantId_userId_createdAt_idx"
  ON "password_history"("tenantId", "userId", "createdAt" DESC);
DO $$ BEGIN
  ALTER TABLE "password_history"
    ADD CONSTRAINT "password_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "password_history_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "users"("id")   ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4) password_reset_tokens (also used for activation via purpose='activation')
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id"          UUID NOT NULL,
    "tenantId"    UUID NOT NULL,
    "userId"      UUID NOT NULL,
    "tokenHash"   TEXT NOT NULL,
    "purpose"     TEXT NOT NULL DEFAULT 'reset',
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "requestedIp" TEXT,
    "userAgent"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_tenantId_userId_purpose_createdAt_idx"
  ON "password_reset_tokens"("tenantId", "userId", "purpose", "createdAt" DESC);
DO $$ BEGIN
  ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "password_reset_tokens_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "users"("id")   ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
