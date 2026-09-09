# Unified Activity Logging Design

**Date:** 2026-09-09

## Goal

Provide one standardized, tenant-safe activity history across web, mobile, API, and system/background channels while preserving the existing server audit and client telemetry records during migration.

## Scope

This first M8 slice covers:

- A canonical `ActivityEvent` persistence model.
- Explicit channel attribution: `web`, `mobile`, `api`, and `system`.
- A shared event vocabulary and validated request contract.
- Canonical writes from server-side audit events and web client events.
- Trusted request-context propagation for channel, request, trace, and session metadata.
- A bounded, idempotent backfill from `audit_logs` and `client_events`.
- One tenant-safe paginated activity endpoint with filtering.
- Web audit-page consumption of the unified activity endpoint, including channel display.
- Producer interfaces for future Flutter and background-job events.
- Automated tests and local manual verification.

Parent portal workflows, offline outbox, NFC/QR, and complete mobile event wiring are separate follow-up slices that consume this contract.

## Architecture

`ActivityEvent` is the canonical application-facing activity record. `AuditLog` and `ClientEvent` remain intact as source-specific records for compatibility, historical retention, and rollback. During this slice, existing server and web producers dual-write to the canonical table and their existing table. A later migration may retire old consumers after parity is proven.

The canonical writer is responsible for tenant and actor attribution, channel validation, metadata redaction policy, and source idempotency. The writer is best effort for non-critical telemetry and must not cause the business request to fail when activity persistence is unavailable. Server-side security and business audit failures are logged with correlation metadata for operations.

The unified read endpoint reads only `ActivityEvent`, uses tenant scope for ordinary users, permits cross-tenant filtering only for users with `tenants.manage`, and returns a stable response shape for the web UI and future mobile clients.

## Event Contract

Each canonical event contains:

- `id`: UUID primary key.
- `tenantId`: required tenant UUID.
- `actorUserId`: nullable UUID; null is allowed only for system/background events or unauthenticated security events where the existing audit behavior permits it.
- `channel`: enum `web | mobile | api | system`.
- `action`: stable string vocabulary, including `view`, `create`, `update`, `delete`, `login`, `logout`, `password_change`, `board_student`, `alight_student`, `sos`, `export`, and `notification_sent`.
- `resourceType`: nullable resource identifier such as `student`, `trip`, or `user`.
- `resourceId`: nullable resource identifier.
- `occurredAt`: event occurrence time; server-derived for request events unless a bounded client event timestamp is explicitly supported.
- `requestId`: nullable request correlation ID.
- `traceId`: nullable distributed trace ID.
- `sessionId`: nullable client/session identifier.
- `ipAddress`: nullable request IP.
- `userAgent`: nullable user-agent or client descriptor.
- `metadata`: nullable JSON object containing non-sensitive event context.
- `sourceType`: nullable source discriminator such as `audit_log` or `client_event`.
- `sourceId`: nullable source UUID used with `sourceType` for idempotent backfill.
- `createdAt`: database creation timestamp.

Secrets, passwords, tokens, HMAC values, and unnecessary personal data must not be copied into `metadata`, `before`, or `after`. Existing redaction behavior remains in force for server audit records.

## Channel Attribution

- HTTP requests default to `api`.
- An authenticated web or mobile client may send an allowlisted channel marker that changes the request context to `web` or `mobile`.
- Browser client-event ingestion always records `web`.
- Future Flutter event ingestion records `mobile`.
- Scheduled workers and internal background actions use an explicit internal `system` context.
- Tenant and actor always come from trusted request context/JWT, never from client event payloads.
- Ordinary clients cannot submit `system` events.

Request, trace, and session identifiers are retained when available so events from a browser/mobile action and its server mutation can be correlated.

## API

Add `GET /v1/activity` with pagination and these filters:

- `q` or action filter.
- `channel`.
- `actorUserId`.
- `resourceType`.
- `resourceId`.
- `from` and `to` timestamps.
- Optional `tenantId` for authorized platform administrators only.

The response includes event identity, actor summary, tenant summary where authorized, channel, action, resource, timestamps, correlation identifiers, and safe metadata. It must not expose secrets or unrestricted raw request bodies.

Existing `GET /v1/audit` remains available during the migration. Existing `POST /v1/audit/events` remains compatible for web clients while writing canonical records.

## Backfill

Backfill existing rows in bounded batches. Each source row maps deterministically to one canonical event using `sourceType + sourceId`; rerunning the command must skip already-imported rows. The command reports inserted, skipped, and failed counts and never deletes or mutates source records. Mapping rules are explicit:

- `audit_logs`: channel `api` unless a trusted historical signal identifies another channel; action/entity/correlation fields map directly; before/after remain safely redacted JSON.
- `client_events`: channel `web`; `kind` maps to `action`; resource/path/payload/correlation fields map to the corresponding canonical fields.
- Missing actor, tenant, or source data causes a counted failure with a diagnostic message rather than an invented value.

## Integrity And Failure Behavior

All canonical writes are tenant-scoped. Duplicate source imports are ignored deterministically. Canonical persistence failures do not break ordinary business requests or client telemetry ingestion, but are logged with request and trace identifiers. Authorization failures on the read endpoint return the existing permission error behavior; tenant mismatch must not leak event existence.

Indexes support tenant timeline queries, tenant/channel/action queries, actor history, resource history, and source idempotency. Retention remains governed by existing policy work and is not changed by this slice.

## Testing

API tests cover:

- Canonical server audit writes with `api` channel.
- Web client ingestion with `web` channel.
- Validated channel handling and rejection of unauthorized `system` submissions.
- Tenant isolation and platform-admin tenant filtering.
- Pagination and activity filters.
- Backfill mapping and rerun idempotency.
- Metadata safety and non-failing best-effort writes.

Web tests cover:

- Unified endpoint response rendering.
- Channel display and filtering.
- Existing audit-page behavior remaining usable during migration.

Manual verification covers login, navigation, password change, an audited business action, and confirmation that the unified activity page shows the correct channel and actor without cross-tenant records.

## Rollout

Implement schema and contracts first, then canonical writing and context propagation, then dual-write producers, backfill, unified reads, and finally web consumption. Run migration and backfill locally before considering the slice complete. Do not delete or deprecate the existing tables in this slice.
