-- CreateEnum
CREATE TYPE "ActivityChannel" AS ENUM ('web', 'mobile', 'api', 'system');

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorUserId" UUID,
    "channel" "ActivityChannel" NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,
    "traceId" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_events_tenantId_occurredAt_idx"
    ON "activity_events"("tenantId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "activity_events_tenantId_channel_occurredAt_idx"
    ON "activity_events"("tenantId", "channel", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "activity_events_tenantId_action_occurredAt_idx"
    ON "activity_events"("tenantId", "action", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "activity_events_tenantId_resourceType_resourceId_occurredAt_idx"
    ON "activity_events"("tenantId", "resourceType", "resourceId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "activity_events_tenantId_actorUserId_occurredAt_idx"
    ON "activity_events"("tenantId", "actorUserId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "activity_events_sourceType_sourceId_key"
    ON "activity_events"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "activity_events"
    ADD CONSTRAINT "activity_events_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events"
    ADD CONSTRAINT "activity_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
