-- AlterTable: track when a tenant is restored from deleted state
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMP(3);
