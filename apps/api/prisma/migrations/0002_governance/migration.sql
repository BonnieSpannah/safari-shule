-- CreateEnum
CREATE TYPE "DncChannel" AS ENUM ('sms', 'email', 'push', 'voice', 'all');
CREATE TYPE "DncReason" AS ENUM ('user_request', 'regulatory', 'bounce', 'complaint', 'quiet_hours');
CREATE TYPE "ConsentPurpose" AS ENUM ('service_delivery', 'marketing', 'analytics', 'research', 'third_party_sharing', 'location_tracking', 'photo_video', 'emergency_contact');
CREATE TYPE "ConsentStatus" AS ENUM ('granted', 'withdrawn', 'expired', 'pending');
CREATE TYPE "DsrKind" AS ENUM ('access', 'rectification', 'erasure', 'portability', 'objection', 'restrict_processing');
CREATE TYPE "DsrStatus" AS ENUM ('received', 'in_progress', 'fulfilled', 'rejected', 'cancelled');
CREATE TYPE "RetentionAction" AS ENUM ('delete', 'anonymize', 'archive');
CREATE TYPE "ImpersonationStatus" AS ENUM ('pending_approval', 'active', 'ended', 'rejected', 'expired');
CREATE TYPE "BackupKind" AS ENUM ('logical_full', 'logical_incremental', 'physical_base', 'wal_archive', 'redis_snapshot', 'files');
CREATE TYPE "BackupTarget" AS ENUM ('s3', 'gdrive', 'local', 'gcs', 'b2');
CREATE TYPE "BackupStatus" AS ENUM ('scheduled', 'running', 'succeeded', 'failed', 'restored', 'expired', 'purged');
CREATE TYPE "ClientEventKind" AS ENUM ('view', 'print', 'download', 'share', 'copy', 'screenshot_attempt', 'visibility_change', 'idle_start', 'idle_resume', 'geo_change', 'export_generated', 'bulk_action', 'role_switch', 'impersonation_start', 'impersonation_end');

-- CreateTable
CREATE TABLE "do_not_contact" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channel" "DncChannel" NOT NULL,
    "destination" TEXT NOT NULL,
    "reason" "DncReason" NOT NULL DEFAULT 'user_request',
    "note" TEXT,
    "requestedBy" UUID,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "do_not_contact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "do_not_contact_tenantId_channel_destination_key" ON "do_not_contact"("tenantId", "channel", "destination");
CREATE INDEX "do_not_contact_tenantId_destination_idx" ON "do_not_contact"("tenantId", "destination");
CREATE INDEX "do_not_contact_tenantId_effectiveTo_idx" ON "do_not_contact"("tenantId", "effectiveTo");
ALTER TABLE "do_not_contact" ADD CONSTRAINT "do_not_contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "subjectUserId" UUID,
    "subjectEmail" TEXT,
    "subjectPhone" TEXT,
    "purpose" "ConsentPurpose" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'granted',
    "legalBasis" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "evidencePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consents_tenantId_subjectUserId_purpose_status_idx" ON "consents"("tenantId", "subjectUserId", "purpose", "status");
CREATE INDEX "consents_tenantId_purpose_status_idx" ON "consents"("tenantId", "purpose", "status");
ALTER TABLE "consents" ADD CONSTRAINT "consents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "subjectUserId" UUID,
    "subjectEmail" TEXT,
    "subjectPhone" TEXT,
    "kind" "DsrKind" NOT NULL,
    "status" "DsrStatus" NOT NULL DEFAULT 'received',
    "details" TEXT,
    "handlerUserId" UUID,
    "dueBy" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "auditPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "data_subject_requests_tenantId_status_dueBy_idx" ON "data_subject_requests"("tenantId", "status", "dueBy");
CREATE INDEX "data_subject_requests_tenantId_subjectUserId_idx" ON "data_subject_requests"("tenantId", "subjectUserId");
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "resource" TEXT NOT NULL,
    "retainDays" INTEGER NOT NULL,
    "action" "RetentionAction" NOT NULL DEFAULT 'anonymize',
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "retention_policies_tenantId_resource_key" ON "retention_policies"("tenantId", "resource");
CREATE INDEX "retention_policies_tenantId_legalHold_idx" ON "retention_policies"("tenantId", "legalHold");
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "supportUserId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "approverUserId" UUID,
    "reason" TEXT NOT NULL,
    "ticketRef" TEXT,
    "status" "ImpersonationStatus" NOT NULL DEFAULT 'pending_approval',
    "scope" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "impersonation_sessions_tenantId_status_expiresAt_idx" ON "impersonation_sessions"("tenantId", "status", "expiresAt");
CREATE INDEX "impersonation_sessions_tenantId_supportUserId_createdAt_idx" ON "impersonation_sessions"("tenantId", "supportUserId", "createdAt" DESC);
CREATE INDEX "impersonation_sessions_tenantId_targetUserId_createdAt_idx" ON "impersonation_sessions"("tenantId", "targetUserId", "createdAt" DESC);
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "backup_jobs" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "kind" "BackupKind" NOT NULL,
    "target" "BackupTarget" NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'scheduled',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "sizeBytes" BIGINT,
    "checksumSha256" TEXT,
    "location" TEXT,
    "retentionDays" INTEGER NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "encryptionKeyId" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "backup_jobs_tenantId_kind_status_createdAt_idx" ON "backup_jobs"("tenantId", "kind", "status", "createdAt" DESC);
CREATE INDEX "backup_jobs_status_finishedAt_idx" ON "backup_jobs"("status", "finishedAt");
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "client_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "sessionId" TEXT,
    "kind" "ClientEventKind" NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "path" TEXT,
    "traceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceFingerprint" TEXT,
    "geoHint" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "client_events_tenantId_kind_createdAt_idx" ON "client_events"("tenantId", "kind", "createdAt" DESC);
CREATE INDEX "client_events_tenantId_userId_createdAt_idx" ON "client_events"("tenantId", "userId", "createdAt" DESC);
CREATE INDEX "client_events_tenantId_resource_resourceId_createdAt_idx" ON "client_events"("tenantId", "resource", "resourceId", "createdAt" DESC);
ALTER TABLE "client_events" ADD CONSTRAINT "client_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
