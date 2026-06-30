-- =========================================================================
-- Safari Shule — initial schema
-- =========================================================================
-- Order: extensions -> enums -> tables -> indexes -> RLS helpers/policies.
-- Spatial columns are typed as Unsupported(...) in Prisma and managed via
-- this raw SQL migration plus typed raw queries in the application layer.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- -------------------------------------------------------------------------
-- ENUMS
-- -------------------------------------------------------------------------
CREATE TYPE "PlanTier"               AS ENUM ('basic','pro','enterprise');
CREATE TYPE "UserStatus"             AS ENUM ('active','invited','suspended');
CREATE TYPE "Gender"                 AS ENUM ('male','female','other');
CREATE TYPE "ParentRelation"         AS ENUM ('mother','father','guardian','other');
CREATE TYPE "AttributeTargetEntity"  AS ENUM ('staff','student','parent','caretaker');
CREATE TYPE "AttributeFieldType"     AS ENUM ('string','number','phone','date','select','boolean');
CREATE TYPE "VehicleStatus"          AS ENUM ('active','maintenance','retired');
CREATE TYPE "VehicleOwnership"       AS ENUM ('school','hired');
CREATE TYPE "RepairStatus"           AS ENUM ('reported','approved','paid','rejected');
CREATE TYPE "FuelPaymentStatus"      AS ENUM ('pending','paid','failed');
CREATE TYPE "GeofenceKind"           AS ENUM ('route_corridor','school_zone','restricted');
CREATE TYPE "TripStatus"             AS ENUM ('scheduled','in_progress','completed','cancelled');
CREATE TYPE "TripDirection"          AS ENUM ('morning_pickup','evening_dropoff');
CREATE TYPE "AttendanceDirection"    AS ENUM ('boarding','alighting');
CREATE TYPE "IncidentKind"           AS ENUM ('sos','traffic','puncture','mechanical','accident','other');
CREATE TYPE "IncidentStatus"         AS ENUM ('reported','acknowledged','resolved');
CREATE TYPE "IncidentSeverity"       AS ENUM ('low','medium','high','critical');
CREATE TYPE "NotificationChannel"    AS ENUM ('sms','email','push');
CREATE TYPE "NotificationStatus"     AS ENUM ('queued','sent','delivered','failed','quota_exceeded');
CREATE TYPE "MpesaTransactionPurpose" AS ENUM ('fuel','repair');
CREATE TYPE "MpesaTransactionStatus" AS ENUM ('initiated','succeeded','failed','cancelled');
CREATE TYPE "RfidDeviceStatus"       AS ENUM ('active','rotating','disabled');

-- -------------------------------------------------------------------------
-- TENANCY / RBAC / AUDIT / FLAGS
-- -------------------------------------------------------------------------
CREATE TABLE "tenants" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"         text NOT NULL UNIQUE,
  "subdomain"    text NOT NULL UNIQUE,
  "name"         text NOT NULL,
  "contactEmail" text NOT NULL,
  "planTier"     "PlanTier" NOT NULL DEFAULT 'basic',
  "isActive"     boolean NOT NULL DEFAULT true,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "tenants_isActive_idx" ON "tenants"("isActive");

CREATE TABLE "tenant_features" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "featureKey" text NOT NULL,
  "enabled"    boolean NOT NULL DEFAULT false,
  "limits"     jsonb NOT NULL DEFAULT '{}'::jsonb,
  "expiresAt"  timestamptz,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "tenant_features_tenantId_featureKey_key" ON "tenant_features"("tenantId","featureKey");
CREATE INDEX "tenant_features_tenantId_enabled_idx" ON "tenant_features"("tenantId","enabled");

CREATE TABLE "users" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "email"        text NOT NULL,
  "phoneE164"    text,
  "passwordHash" text NOT NULL,
  "status"       "UserStatus" NOT NULL DEFAULT 'invited',
  "fullName"     text NOT NULL,
  "lastLoginAt"  timestamptz,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId","email");
CREATE INDEX "users_tenantId_status_idx" ON "users"("tenantId","status");

CREATE TABLE "roles" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "key"       text NOT NULL,
  "label"     text NOT NULL,
  "isSystem"  boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "roles_tenantId_key_key" ON "roles"("tenantId","key");

CREATE TABLE "permissions" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "key"         text NOT NULL,
  "description" text NOT NULL
);
CREATE UNIQUE INDEX "permissions_tenantId_key_key" ON "permissions"("tenantId","key");

CREATE TABLE "role_permissions" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"     uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "roleId"       uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permissionId" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "role_permissions_tenantId_roleId_permissionId_key"
  ON "role_permissions"("tenantId","roleId","permissionId");

CREATE TABLE "user_roles" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "userId"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "roleId"    uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "user_roles_tenantId_userId_roleId_key"
  ON "user_roles"("tenantId","userId","roleId");

CREATE TABLE "refresh_tokens" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "userId"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash" text NOT NULL UNIQUE,
  "revokedAt" timestamptz,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "refresh_tokens_tenantId_userId_idx" ON "refresh_tokens"("tenantId","userId");

CREATE TABLE "otp_codes" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "phoneE164"  text NOT NULL,
  "codeHash"   text NOT NULL,
  "purpose"    text NOT NULL,
  "attempts"   int NOT NULL DEFAULT 0,
  "expiresAt"  timestamptz NOT NULL,
  "consumedAt" timestamptz,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "otp_codes_tenantId_phoneE164_purpose_idx"
  ON "otp_codes"("tenantId","phoneE164","purpose");

CREATE TABLE "audit_logs" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "actorUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action"      text NOT NULL,
  "entityType"  text NOT NULL,
  "entityId"    text,
  "before"      jsonb,
  "after"       jsonb,
  "ipAddress"   text,
  "userAgent"   text,
  "requestId"   text,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "audit_logs_tenantId_entityType_createdAt_idx"
  ON "audit_logs"("tenantId","entityType","createdAt" DESC);
CREATE INDEX "audit_logs_tenantId_actorUserId_createdAt_idx"
  ON "audit_logs"("tenantId","actorUserId","createdAt" DESC);

CREATE TABLE "invitations" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "inviterId"  uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email"      text NOT NULL,
  "phoneE164"  text,
  "fullName"   text NOT NULL,
  "roleKeys"   text[] NOT NULL,
  "tokenHash"  text NOT NULL UNIQUE,
  "acceptedAt" timestamptz,
  "expiresAt"  timestamptz NOT NULL,
  "createdAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "invitations_tenantId_email_idx" ON "invitations"("tenantId","email");

-- -------------------------------------------------------------------------
-- CUSTOM ATTRIBUTE ENGINE
-- -------------------------------------------------------------------------
CREATE TABLE "attribute_definitions" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"     uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "targetEntity" "AttributeTargetEntity" NOT NULL,
  "slug"         text NOT NULL,
  "label"        text NOT NULL,
  "fieldType"    "AttributeFieldType" NOT NULL,
  "isRequired"   boolean NOT NULL DEFAULT false,
  "isNullable"   boolean NOT NULL DEFAULT true,
  "options"      jsonb,
  "regex"        text,
  "min"          double precision,
  "max"          double precision,
  "sortOrder"    int NOT NULL DEFAULT 0,
  "archivedAt"   timestamptz,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "attribute_definitions_tenantId_targetEntity_slug_key"
  ON "attribute_definitions"("tenantId","targetEntity","slug");
CREATE INDEX "attribute_definitions_tenantId_targetEntity_archivedAt_idx"
  ON "attribute_definitions"("tenantId","targetEntity","archivedAt");

-- -------------------------------------------------------------------------
-- PROFILES
-- -------------------------------------------------------------------------
CREATE TABLE "staff" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "userId"             uuid UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
  "employeeNumber"     text NOT NULL,
  "legalName"          text NOT NULL,
  "nationalId"         text NOT NULL,
  "phoneE164"          text NOT NULL,
  "email"              text,
  "position"           text NOT NULL,
  "dateOfBirth"        date NOT NULL,
  "gender"             "Gender" NOT NULL,
  "flexibleAttributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"          timestamptz NOT NULL DEFAULT now(),
  "updatedAt"          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "staff_tenantId_employeeNumber_key" ON "staff"("tenantId","employeeNumber");
CREATE INDEX "staff_tenantId_legalName_idx" ON "staff"("tenantId","legalName");

CREATE TABLE "students" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"               uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "admissionNumber"        text NOT NULL,
  "legalName"              text NOT NULL,
  "birthCertificateNumber" text,
  "classroom"              text,
  "dateOfBirth"            date NOT NULL,
  "gender"                 "Gender" NOT NULL,
  "flexibleAttributes"     jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"              timestamptz NOT NULL DEFAULT now(),
  "updatedAt"              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "students_tenantId_admissionNumber_key" ON "students"("tenantId","admissionNumber");
CREATE INDEX "students_tenantId_legalName_idx" ON "students"("tenantId","legalName");

CREATE TABLE "parents" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "userId"             uuid UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
  "legalName"          text NOT NULL,
  "phoneE164"          text NOT NULL,
  "email"              text,
  "nationalId"         text,
  "occupation"         text,
  "dateOfBirth"        date NOT NULL,
  "gender"             "Gender" NOT NULL,
  "flexibleAttributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"          timestamptz NOT NULL DEFAULT now(),
  "updatedAt"          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "parents_tenantId_phoneE164_key" ON "parents"("tenantId","phoneE164");
CREATE INDEX "parents_tenantId_legalName_idx" ON "parents"("tenantId","legalName");

CREATE TABLE "caretakers" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "legalName"          text NOT NULL,
  "phoneE164"          text NOT NULL,
  "relationship"       text NOT NULL,
  "nationalId"         text,
  "dateOfBirth"        date NOT NULL,
  "gender"             "Gender" NOT NULL,
  "flexibleAttributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"          timestamptz NOT NULL DEFAULT now(),
  "updatedAt"          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "caretakers_tenantId_phoneE164_key" ON "caretakers"("tenantId","phoneE164");

CREATE TABLE "parent_students" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "parentId"  uuid NOT NULL REFERENCES "parents"("id") ON DELETE CASCADE,
  "studentId" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "relation"  "ParentRelation" NOT NULL DEFAULT 'guardian',
  "isPrimary" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "parent_students_tenantId_parentId_studentId_key"
  ON "parent_students"("tenantId","parentId","studentId");
CREATE INDEX "parent_students_tenantId_studentId_idx" ON "parent_students"("tenantId","studentId");

CREATE TABLE "student_caretakers" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "studentId"   uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "caretakerId" uuid NOT NULL REFERENCES "caretakers"("id") ON DELETE CASCADE,
  "isPrimary"   boolean NOT NULL DEFAULT false,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "student_caretakers_tenantId_studentId_caretakerId_key"
  ON "student_caretakers"("tenantId","studentId","caretakerId");

-- -------------------------------------------------------------------------
-- FLEET / ROUTES / FINANCIALS
-- -------------------------------------------------------------------------
CREATE TABLE "vehicles" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"            uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "registration"        text NOT NULL,
  "make"                text NOT NULL,
  "model"               text NOT NULL,
  "year"                int NOT NULL,
  "capacity"            int NOT NULL,
  "ownership"           "VehicleOwnership" NOT NULL,
  "status"              "VehicleStatus" NOT NULL DEFAULT 'active',
  "assignedDriverId"    uuid,
  "assignedAssistantId" uuid,
  "odometerKm"          int NOT NULL DEFAULT 0,
  "createdAt"           timestamptz NOT NULL DEFAULT now(),
  "updatedAt"           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "vehicles_tenantId_registration_key" ON "vehicles"("tenantId","registration");
CREATE INDEX "vehicles_tenantId_status_idx" ON "vehicles"("tenantId","status");

CREATE TABLE "insurance_records" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"     uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "vehicleId"    uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE CASCADE,
  "provider"     text NOT NULL,
  "policyNumber" text NOT NULL,
  "premiumKes"   int NOT NULL,
  "startsOn"     date NOT NULL,
  "expiresOn"    date NOT NULL,
  "documentUrl"  text,
  "createdAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "insurance_records_tenantId_vehicleId_expiresOn_idx"
  ON "insurance_records"("tenantId","vehicleId","expiresOn");

CREATE TABLE "mpesa_transactions" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "purpose"            "MpesaTransactionPurpose" NOT NULL,
  "amountKes"          int NOT NULL,
  "phoneE164"          text NOT NULL,
  "accountReference"   text NOT NULL,
  "checkoutRequestId"  text NOT NULL UNIQUE,
  "merchantRequestId"  text,
  "mpesaReceiptNumber" text,
  "status"             "MpesaTransactionStatus" NOT NULL DEFAULT 'initiated',
  "resultCode"         int,
  "resultDescription"  text,
  "callbackPayload"    jsonb,
  "initiatedAt"        timestamptz NOT NULL DEFAULT now(),
  "completedAt"        timestamptz
);
CREATE INDEX "mpesa_transactions_tenantId_status_initiatedAt_idx"
  ON "mpesa_transactions"("tenantId","status","initiatedAt" DESC);

CREATE TABLE "fuel_logs" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "vehicleId"          uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE CASCADE,
  "driverUserId"       uuid NOT NULL,
  "liters"             numeric(10,2) NOT NULL,
  "costKes"            int NOT NULL,
  "station"            text NOT NULL,
  "odometerKm"         int NOT NULL,
  "mpesaTransactionId" uuid REFERENCES "mpesa_transactions"("id") ON DELETE SET NULL,
  "paymentStatus"      "FuelPaymentStatus" NOT NULL DEFAULT 'pending',
  "occurredAt"         timestamptz NOT NULL,
  "createdAt"          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "fuel_logs_tenantId_vehicleId_occurredAt_idx"
  ON "fuel_logs"("tenantId","vehicleId","occurredAt" DESC);

CREATE TABLE "repair_logs" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "vehicleId"          uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE CASCADE,
  "reportedByUserId"   uuid NOT NULL,
  "approvalUserId"     uuid,
  "description"        text NOT NULL,
  "vendor"             text NOT NULL,
  "costKes"            int NOT NULL,
  "status"             "RepairStatus" NOT NULL DEFAULT 'reported',
  "occurredOn"         date NOT NULL,
  "mpesaTransactionId" uuid REFERENCES "mpesa_transactions"("id") ON DELETE SET NULL,
  "createdAt"          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "repair_logs_tenantId_vehicleId_status_idx"
  ON "repair_logs"("tenantId","vehicleId","status");

CREATE TABLE "routes" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"        text NOT NULL,
  "description" text,
  "isActive"    boolean NOT NULL DEFAULT true,
  "startPoint"  geography(Point, 4326) NOT NULL,
  "endPoint"    geography(Point, 4326) NOT NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "routes_tenantId_name_key" ON "routes"("tenantId","name");
CREATE INDEX "routes_tenantId_isActive_idx" ON "routes"("tenantId","isActive");
CREATE INDEX "routes_startPoint_gix" ON "routes" USING GIST ("startPoint");
CREATE INDEX "routes_endPoint_gix"   ON "routes" USING GIST ("endPoint");

CREATE TABLE "bus_stops" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"             uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "routeId"              uuid NOT NULL REFERENCES "routes"("id") ON DELETE CASCADE,
  "name"                 text NOT NULL,
  "pickupOrder"          int NOT NULL,
  "scheduledPickupTime"  text NOT NULL,
  "scheduledDropoffTime" text NOT NULL,
  "location"             geography(Point, 4326) NOT NULL
);
CREATE UNIQUE INDEX "bus_stops_tenantId_routeId_pickupOrder_key"
  ON "bus_stops"("tenantId","routeId","pickupOrder");
CREATE INDEX "bus_stops_tenantId_routeId_idx" ON "bus_stops"("tenantId","routeId");
CREATE INDEX "bus_stops_location_gix" ON "bus_stops" USING GIST ("location");

CREATE TABLE "geofences" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"      text NOT NULL,
  "kind"      "GeofenceKind" NOT NULL,
  "routeId"   uuid REFERENCES "routes"("id") ON DELETE SET NULL,
  "vehicleId" uuid REFERENCES "vehicles"("id") ON DELETE SET NULL,
  "polygon"   geography(Polygon, 4326) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "geofences_tenantId_kind_idx" ON "geofences"("tenantId","kind");
CREATE INDEX "geofences_polygon_gix" ON "geofences" USING GIST ("polygon");

CREATE TABLE "route_assignments" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "routeId"    uuid NOT NULL REFERENCES "routes"("id") ON DELETE CASCADE,
  "vehicleId"  uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE CASCADE,
  "daysOfWeek" int[] NOT NULL,
  "validFrom"  date NOT NULL,
  "validTo"    date
);
CREATE INDEX "route_assignments_tenantId_routeId_idx"   ON "route_assignments"("tenantId","routeId");
CREATE INDEX "route_assignments_tenantId_vehicleId_idx" ON "route_assignments"("tenantId","vehicleId");

CREATE TABLE "student_route_assignments" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "studentId" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "routeId"   uuid NOT NULL REFERENCES "routes"("id") ON DELETE CASCADE,
  "busStopId" uuid NOT NULL REFERENCES "bus_stops"("id") ON DELETE CASCADE,
  "validFrom" date NOT NULL,
  "validTo"   date
);
CREATE UNIQUE INDEX "student_route_assignments_tenantId_studentId_routeId_validFrom_key"
  ON "student_route_assignments"("tenantId","studentId","routeId","validFrom");
CREATE INDEX "student_route_assignments_tenantId_routeId_idx"
  ON "student_route_assignments"("tenantId","routeId");

-- -------------------------------------------------------------------------
-- TRIPS, TELEMETRY, INCIDENTS
-- -------------------------------------------------------------------------
CREATE TABLE "trips" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"         uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "routeId"          uuid NOT NULL REFERENCES "routes"("id") ON DELETE RESTRICT,
  "vehicleId"        uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE RESTRICT,
  "driverUserId"     uuid NOT NULL,
  "assistantUserId"  uuid,
  "scheduledStart"   timestamptz NOT NULL,
  "startedAt"        timestamptz,
  "endedAt"          timestamptz,
  "status"           "TripStatus" NOT NULL DEFAULT 'scheduled',
  "direction"        "TripDirection" NOT NULL,
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "trips_tenantId_status_idx" ON "trips"("tenantId","status");
CREATE INDEX "trips_tenantId_vehicleId_scheduledStart_idx"
  ON "trips"("tenantId","vehicleId","scheduledStart");
CREATE INDEX "trips_active_partial_idx"
  ON "trips"("tenantId","vehicleId") WHERE "status" = 'in_progress';

CREATE TABLE "trip_passengers" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "tripId"     uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "studentId"  uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "expected"   boolean NOT NULL DEFAULT true,
  "boardedAt"  timestamptz,
  "alightedAt" timestamptz
);
CREATE UNIQUE INDEX "trip_passengers_tenantId_tripId_studentId_key"
  ON "trip_passengers"("tenantId","tripId","studentId");

CREATE TABLE "trip_location_snapshots" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "tripId"     uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "speedKph"   double precision NOT NULL,
  "headingDeg" double precision NOT NULL,
  "recordedAt" timestamptz NOT NULL,
  "location"   geography(Point, 4326) NOT NULL
);
CREATE INDEX "trip_location_snapshots_tenantId_tripId_recordedAt_idx"
  ON "trip_location_snapshots"("tenantId","tripId","recordedAt" DESC);
CREATE INDEX "trip_location_snapshots_location_gix"
  ON "trip_location_snapshots" USING GIST ("location");

CREATE TABLE "incidents" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"         uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "tripId"           uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "kind"             "IncidentKind" NOT NULL,
  "severity"         "IncidentSeverity" NOT NULL DEFAULT 'medium',
  "status"           "IncidentStatus" NOT NULL DEFAULT 'reported',
  "reportedByUserId" uuid,
  "description"      text NOT NULL,
  "location"         geography(Point, 4326),
  "acknowledgedAt"   timestamptz,
  "resolvedAt"       timestamptz,
  "resolutionNotes"  text,
  "occurredAt"       timestamptz NOT NULL DEFAULT now(),
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "incidents_tenantId_status_severity_idx" ON "incidents"("tenantId","status","severity");
CREATE INDEX "incidents_tenantId_kind_occurredAt_idx"
  ON "incidents"("tenantId","kind","occurredAt" DESC);
CREATE INDEX "incidents_open_partial_idx"
  ON "incidents"("tenantId","occurredAt" DESC) WHERE "status" <> 'resolved';

CREATE TABLE "incident_emergency_contacts" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"      text NOT NULL,
  "phoneE164" text NOT NULL,
  "role"      text NOT NULL,
  "priority"  int NOT NULL DEFAULT 0,
  "isActive"  boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "incident_emergency_contacts_tenantId_isActive_priority_idx"
  ON "incident_emergency_contacts"("tenantId","isActive","priority");

-- -------------------------------------------------------------------------
-- RFID
-- -------------------------------------------------------------------------
CREATE TABLE "rfid_devices" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"            uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "deviceId"            text NOT NULL,
  "vehicleId"           uuid REFERENCES "vehicles"("id") ON DELETE SET NULL,
  "apiKeyHash"          text NOT NULL,
  "hmacSecretEncrypted" text NOT NULL,
  "status"              "RfidDeviceStatus" NOT NULL DEFAULT 'active',
  "lastSeenAt"          timestamptz,
  "keyRotatedAt"        timestamptz,
  "createdAt"           timestamptz NOT NULL DEFAULT now(),
  "updatedAt"           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "rfid_devices_tenantId_deviceId_key" ON "rfid_devices"("tenantId","deviceId");
CREATE INDEX "rfid_devices_tenantId_status_idx" ON "rfid_devices"("tenantId","status");

CREATE TABLE "rfid_tags" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "tagUid"    text NOT NULL,
  "studentId" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "issuedAt"  timestamptz NOT NULL DEFAULT now(),
  "revokedAt" timestamptz
);
CREATE UNIQUE INDEX "rfid_tags_tenantId_tagUid_key" ON "rfid_tags"("tenantId","tagUid");
CREATE INDEX "rfid_tags_tenantId_studentId_idx" ON "rfid_tags"("tenantId","studentId");

CREATE TABLE "attendance_events" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "tripId"     uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "studentId"  uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "deviceId"   uuid NOT NULL REFERENCES "rfid_devices"("id") ON DELETE CASCADE,
  "tagId"      uuid NOT NULL REFERENCES "rfid_tags"("id") ON DELETE CASCADE,
  "direction"  "AttendanceDirection" NOT NULL,
  "scannedAt"  timestamptz NOT NULL,
  "ingestedAt" timestamptz NOT NULL DEFAULT now(),
  "rawPayload" jsonb NOT NULL
);
CREATE UNIQUE INDEX "attendance_events_tenantId_deviceId_tagId_scannedAt_key"
  ON "attendance_events"("tenantId","deviceId","tagId","scannedAt");
CREATE INDEX "attendance_events_tenantId_tripId_scannedAt_idx"
  ON "attendance_events"("tenantId","tripId","scannedAt" DESC);
CREATE INDEX "attendance_events_tenantId_studentId_scannedAt_idx"
  ON "attendance_events"("tenantId","studentId","scannedAt" DESC);

CREATE TABLE "unknown_tag_scans" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "deviceId"   text NOT NULL,
  "tagUid"     text NOT NULL,
  "scannedAt"  timestamptz NOT NULL,
  "ingestedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "unknown_tag_scans_tenantId_tagUid_idx" ON "unknown_tag_scans"("tenantId","tagUid");

-- -------------------------------------------------------------------------
-- OUTBOUND MESSAGES
-- -------------------------------------------------------------------------
CREATE TABLE "outbound_messages" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"          uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "channel"           "NotificationChannel" NOT NULL,
  "to"                text NOT NULL,
  "templateId"        text NOT NULL,
  "body"              text NOT NULL,
  "status"            "NotificationStatus" NOT NULL DEFAULT 'queued',
  "providerMessageId" text,
  "costCents"         int,
  "error"             text,
  "attempts"          int NOT NULL DEFAULT 0,
  "requestId"         text,
  "createdAt"         timestamptz NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "outbound_messages_tenantId_channel_status_createdAt_idx"
  ON "outbound_messages"("tenantId","channel","status","createdAt" DESC);
CREATE INDEX "outbound_messages_tenantId_templateId_createdAt_idx"
  ON "outbound_messages"("tenantId","templateId","createdAt" DESC);

-- -------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (defense-in-depth alongside app-layer scoping)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'tenant_features','users','roles','permissions','role_permissions','user_roles',
      'refresh_tokens','otp_codes','audit_logs','invitations','attribute_definitions',
      'staff','students','parents','caretakers','parent_students','student_caretakers',
      'vehicles','insurance_records','fuel_logs','repair_logs','routes','bus_stops',
      'geofences','route_assignments','student_route_assignments','trips','trip_passengers',
      'trip_location_snapshots','incidents','incident_emergency_contacts','rfid_devices',
      'rfid_tags','attendance_events','unknown_tag_scans','mpesa_transactions','outbound_messages'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING ("tenantId" = app_current_tenant()) WITH CHECK ("tenantId" = app_current_tenant())',
      t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- A bypass role for migrations + maintenance. The application role is
-- intentionally NOT a superuser and is subject to RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'safari_app') THEN
    CREATE ROLE safari_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO safari_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO safari_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO safari_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO safari_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO safari_app;
