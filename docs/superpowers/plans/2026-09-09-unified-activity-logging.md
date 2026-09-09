# Unified Activity Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one tenant-safe, channel-aware activity history for web, mobile, API, and system/background events while preserving existing audit and client-event records during migration.

**Architecture:** Add a canonical `ActivityEvent` table and shared event contract. Existing `AuditLog` and `ClientEvent` writers remain compatible and dual-write canonical records. Add a unified tenant-safe API and migrate the web audit page to read it, while retaining existing endpoints and source tables for rollback and historical compatibility.

**Tech Stack:** NestJS 10.4.4, Prisma 5.20, PostgreSQL 16/PostGIS 3.4, Zod 3.23.8, React 18/Vite, TanStack Query, Vitest, Jest/Supertest.

## Global Constraints

- Tenant scoping is mandatory. Every Prisma `.create()` MUST pass an explicit `tenantId: requireTenantId()` unless the write is inside a deliberate bypass/seeding path with an explicit tenant ID.
- Reads use `prisma.scoped`; bypass is limited to `runWithBypass()` for platform, migration, or system paths.
- The JWT `tid` claim is authoritative; client tenant headers cannot select another tenant.
- Existing `AuditLog` and `ClientEvent` tables remain intact and their endpoints remain compatible in this slice.
- Canonical activity writes must not break the business request or client telemetry when persistence fails; failures must be logged with correlation metadata.
- Ordinary clients cannot submit `system` channel events.
- Actor and tenant identity come from trusted request context/JWT, never from client payloads.
- Do not store passwords, tokens, HMAC secrets, or unnecessary personal data in activity metadata.
- Unauthorized cross-tenant activity reads must not leak event existence.
- No comments unless the WHY is non-obvious. No `// TODO`, stubs, or placeholder handlers.
- Do not push or commit unless explicitly requested by the user.

---

## File Map

**Create:**

- `apps/api/src/audit/activity.types.ts` — canonical channel/action types and writer/query DTOs.
- `apps/api/src/audit/activity.service.ts` — validated canonical writer and query service.
- `apps/api/src/audit/activity.controller.ts` — `GET /v1/activity` endpoint.
- `apps/api/scripts/backfill-activity.ts` — bounded idempotent source backfill command.
- `apps/api/test/activity.e2e-spec.ts` — canonical writes, channels, isolation, filters, and authorization.
- `apps/web/src/lib/api/activity.ts` — typed unified activity API client.
- `apps/web/src/routes/audit/__tests__/AuditPage.test.tsx` — unified activity rendering and channel coverage.

**Modify:**

- `apps/api/prisma/schema.prisma` — `ActivityChannel`, `ActivityEvent`, and indexes.
- `apps/api/src/common/context/request-context.ts` — optional trusted channel/session/trace context fields and helpers.
- `apps/api/src/common/context/request-context.middleware.ts` — derive and validate channel metadata from request headers.
- `apps/api/src/audit/audit.service.ts` — canonical server-audit dual-write.
- `apps/api/src/audit/audit.controller.ts` — canonical web-event dual-write with `web` channel.
- `apps/api/src/audit/audit.module.ts` — register/export activity service and controller.
- `apps/api/src/audit/audit.interceptor.ts` — preserve source audit behavior while passing channel/correlation metadata.
- `apps/web/src/lib/api/audit.ts` — shared activity response types only if existing types are reused.
- `apps/web/src/routes/audit/AuditPage.tsx` — consume `/v1/activity`, add channel column/filter.
- `apps/api/test/helpers.ts` — expose any isolated activity seed data needed by e2e tests.

---

### Task 1: Canonical Schema And Shared Contract

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/audit/activity.types.ts`
- Test: `apps/api/test/activity.e2e-spec.ts`

**Interfaces:**

- Produces `ActivityChannel = 'web' | 'mobile' | 'api' | 'system'`.
- Produces canonical action type and `ActivityRecord` writer shape.
- Produces Prisma `ActivityEvent` with source idempotency fields and tenant/channel/resource indexes.

- [ ] **Step 1: Write failing schema contract test**

Add an e2e test that attempts to create a canonical activity event through the activity service contract and asserts the returned record includes tenant, channel, action, actor, and source fields. The test should fail because the model/service does not exist.

- [ ] **Step 2: Run the focused test to verify failure**

Run:

```bash
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/activity.e2e-spec.ts --runInBand
```

Expected: FAIL because the activity model/service is not implemented.

- [ ] **Step 3: Add the Prisma model and migration**

Add:

```prisma
enum ActivityChannel {
  web
  mobile
  api
  system
}

model ActivityEvent {
  id            String          @id @default(uuid()) @db.Uuid
  tenantId      String          @db.Uuid
  actorUserId   String?         @db.Uuid
  channel       ActivityChannel
  action        String
  resourceType  String?
  resourceId    String?
  occurredAt    DateTime        @default(now())
  requestId     String?
  traceId       String?
  sessionId     String?
  ipAddress     String?
  userAgent     String?
  metadata      Json?
  sourceType    String?
  sourceId      String?
  createdAt     DateTime        @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  actor  User?  @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@unique([sourceType, sourceId])
  @@index([tenantId, occurredAt(sort: Desc)])
  @@index([tenantId, channel, occurredAt(sort: Desc)])
  @@index([tenantId, action, occurredAt(sort: Desc)])
  @@index([tenantId, resourceType, resourceId, occurredAt(sort: Desc)])
  @@index([tenantId, actorUserId, occurredAt(sort: Desc)])
  @@map("activity_events")
}
```

Add the corresponding `Tenant` and `User` relation fields required by Prisma. Generate the migration with the repository Prisma command and run `prisma generate`.

- [ ] **Step 4: Add the TypeScript contract**

Define `ActivityChannel`, an allowlisted action union for known actions plus a string-compatible writer action if the existing audit catalog is open-ended, and exact input/output interfaces used by the service and controller. Metadata must be `Record<string, unknown>` and source fields must be optional.

- [ ] **Step 5: Run the focused test and Prisma validation**

Run:

```bash
pnpm --filter @safari-shule/api exec prisma validate
pnpm --filter @safari-shule/api exec prisma generate
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/activity.e2e-spec.ts --runInBand
```

Expected: schema validation succeeds and the test advances to the missing writer implementation.

---

### Task 2: Request Context And Canonical Writer

**Files:**

- Modify: `apps/api/src/common/context/request-context.ts`
- Modify: `apps/api/src/common/context/request-context.middleware.ts`
- Create: `apps/api/src/audit/activity.service.ts`
- Modify: `apps/api/src/audit/audit.module.ts`
- Test: `apps/api/test/activity.e2e-spec.ts`

**Interfaces:**

- `ActivityService.record(input: ActivityRecordInput): Promise<void>`.
- `ActivityService.list(query, authContext): Promise<PaginatedActivityResponse>`.
- Request context exposes `channel`, `traceId`, `requestId`, and optional `sessionId`.

- [ ] **Step 1: Add failing writer tests**

Cover successful canonical writes, actor/tenant derivation from context, metadata retention, and persistence failure being logged without throwing to the caller.

- [ ] **Step 2: Run the focused writer tests and verify failure**

Run the activity e2e spec and expect failures for the missing service and context fields.

- [ ] **Step 3: Implement context propagation**

Use the existing request context setup to derive `api` by default. Accept only `web` or `mobile` from the allowlisted client-channel header. Ignore or reject `system` from ordinary HTTP clients. Preserve existing tenant and actor derivation and copy request, trace, and session identifiers when present.

- [ ] **Step 4: Implement `ActivityService.record`**

Derive tenant and actor from the current context unless the caller is an explicit system/bypass path. Sanitize metadata to JSON-safe values without secrets, set correlation fields from context, and create the row with an explicit tenant ID. Catch persistence failures, log action/resource/correlation details, and return without throwing.

- [ ] **Step 5: Run writer tests and typecheck**

Run:

```bash
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/activity.e2e-spec.ts --runInBand
pnpm --filter @safari-shule/api exec tsc --noEmit
```

Expected: canonical writer tests pass and API typecheck succeeds.

---

### Task 3: Dual-Write Existing Server And Web Producers

**Files:**

- Modify: `apps/api/src/audit/audit.service.ts`
- Modify: `apps/api/src/audit/audit.interceptor.ts`
- Modify: `apps/api/src/audit/audit.controller.ts`
- Modify: `apps/api/src/audit/audit.module.ts`
- Test: `apps/api/test/activity.e2e-spec.ts`

**Interfaces:**

- Existing `AuditService.record` behavior and signature remain compatible.
- Existing `POST /v1/audit/events` response remains `{ accepted: number }`.
- Canonical server events use `channel: api` by default and client events use `channel: web`.

- [ ] **Step 1: Add failing dual-write tests**

Test one audited server mutation and one web client-event batch. Assert the existing source row still exists and exactly one canonical row has the expected action, channel, resource, actor, and correlation values.

- [ ] **Step 2: Run focused tests to verify failure**

Run the activity e2e spec and confirm canonical rows are absent before the implementation.

- [ ] **Step 3: Add server-audit dual-write**

Inject `ActivityService` into the existing audit service or its owning module. Preserve existing `AuditLog` writes and call the canonical writer with `sourceType: 'audit_log'` and the created source ID when available. Keep existing redaction for before/after and map request context channel/correlation fields.

- [ ] **Step 4: Add web-event dual-write**

Validate the existing client-event schema as before, force canonical channel `web` for this endpoint, map `kind` to `action`, and preserve the existing `ClientEvent` batch insert and response. Use each source client-event ID for idempotency only when the database returns IDs; otherwise use a deterministic request/event source key.

- [ ] **Step 5: Run regression tests**

Run:

```bash
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/activity.e2e-spec.ts test/audit-events.e2e-spec.ts --runInBand
pnpm --filter @safari-shule/api exec tsc --noEmit
```

Expected: both canonical and existing audit/client-event assertions pass.

---

### Task 4: Backfill Existing Sources

**Files:**

- Create: `apps/api/scripts/backfill-activity.ts`
- Test: `apps/api/test/activity-backfill.e2e-spec.ts`
- Modify: `apps/api/package.json` only if a script alias is needed

**Interfaces:**

- Script accepts optional batch-size and dry-run flags through process arguments.
- Output reports `inserted`, `skipped`, and `failed` counts.
- Rerunning the command is idempotent by `(sourceType, sourceId)`.

- [ ] **Step 1: Write failing backfill tests**

Seed one `AuditLog` and one `ClientEvent`, run the backfill function with a small batch size, and assert canonical mappings. Run it a second time and assert no duplicate canonical rows.

- [ ] **Step 2: Run the focused backfill test to verify failure**

Run the new backfill e2e spec and expect the command/module to be missing.

- [ ] **Step 3: Implement bounded source readers and mappings**

Read source rows in bounded batches. Map audit rows to `channel: api` and client rows to `channel: web`; preserve safe JSON and correlation fields. Use `createMany({ skipDuplicates: true })` or an equivalent unique-key-safe insert. Count and report invalid rows without inventing tenant or actor values.

- [ ] **Step 4: Add dry-run and deterministic reporting**

Dry-run performs validation and count reporting without writes. Normal mode writes rows and reports totals. The script loads the repository environment in the same way as the existing API seed commands.

- [ ] **Step 5: Run backfill tests and typecheck**

Run:

```bash
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/activity-backfill.e2e-spec.ts --runInBand
pnpm --filter @safari-shule/api exec tsc --noEmit
```

Expected: mapping and rerun idempotency pass.

---

### Task 5: Unified Activity API

**Files:**

- Create: `apps/api/src/audit/activity.controller.ts`
- Modify: `apps/api/src/audit/audit.module.ts`
- Modify: `apps/api/src/audit/activity.service.ts`
- Test: `apps/api/test/activity.e2e-spec.ts`

**Interfaces:**

- `GET /v1/activity` returns the repository `paginated` shape with canonical activity rows.
- Supported filters are `q`, `action`, `channel`, `actorUserId`, `resourceType`, `resourceId`, `from`, `to`, `page`, `pageSize`, and authorized platform `tenantId`.

- [ ] **Step 1: Add failing endpoint tests**

Cover tenant isolation, platform-admin tenant filtering, channel/action/resource/date filters, pagination, and permission rejection.

- [ ] **Step 2: Run focused endpoint tests to verify failure**

Run the activity e2e spec and expect a 404 for the missing route.

- [ ] **Step 3: Implement query validation and authorization**

Use Zod query validation. Ordinary users query only their tenant. Users with `tenants.manage` may omit tenant filtering or select one tenant through an explicit authorized filter. Return actor and tenant summaries, safe metadata, and correlation fields without raw request bodies or secrets.

- [ ] **Step 4: Implement indexed query and stable response**

Use the existing pagination helpers and Prisma query filters. Sort by `occurredAt DESC`, then `createdAt DESC`. Ensure tenant mismatch produces no records and no existence leak.

- [ ] **Step 5: Run endpoint and regression tests**

Run:

```bash
pnpm --filter @safari-shule/api exec jest --config test/jest-e2e.json test/activity.e2e-spec.ts test/cross-tenant-isolation.e2e-spec.ts --runInBand
pnpm --filter @safari-shule/api exec tsc --noEmit
pnpm --filter @safari-shule/api run build
```

Expected: endpoint, isolation, typecheck, and build pass.

---

### Task 6: Web Unified Activity View

**Files:**

- Create: `apps/web/src/lib/api/activity.ts`
- Modify: `apps/web/src/routes/audit/AuditPage.tsx`
- Create: `apps/web/src/routes/audit/__tests__/AuditPage.test.tsx`

**Interfaces:**

- `listActivity(params)` calls `GET /v1/activity` and returns typed paginated activity rows.
- The page displays channel, action, actor, resource, timestamp, and safe detail metadata.
- Existing audit navigation and permission gate remain unchanged.

- [ ] **Step 1: Write failing web tests**

Mock `listActivity`, render the audit page, and assert the channel column shows `Web`, `API`, `Mobile`, or `System` according to returned data. Assert the channel filter changes the request parameters.

- [ ] **Step 2: Run focused web tests to verify failure**

Run:

```bash
pnpm --filter @safari-shule/web test -- src/routes/audit/__tests__/AuditPage.test.tsx
```

Expected: FAIL because the page still calls the legacy audit client or lacks channel rendering.

- [ ] **Step 3: Add typed activity API client**

Define response and filter types matching the API contract. Reuse existing pagination and date formatting conventions.

- [ ] **Step 4: Migrate the page**

Replace the page query with `listActivity`, preserve loading/empty/error states and export behavior, add a channel column/filter, and keep the existing detail modal safe by showing only canonical metadata and correlation fields.

- [ ] **Step 5: Run web checks**

Run:

```bash
pnpm --filter @safari-shule/web test -- src/routes/audit/__tests__/AuditPage.test.tsx
pnpm --filter @safari-shule/web test
pnpm --filter @safari-shule/web typecheck
pnpm --filter @safari-shule/web build
```

Expected: focused test, full web suite, typecheck, and build pass.

---

### Task 7: Final Integration Verification And Documentation

**Files:**

- Modify: `docs/ROADMAP.md`
- Modify: `docs/AUDIT-INTEGRATION.md`
- Modify: `docs/TESTING.md` if command documentation needs updating

- [ ] **Step 1: Run full API and web verification**

Run the focused suites, API build/typecheck, full web tests/typecheck/build, and the backfill dry-run against the local database.

- [ ] **Step 2: Manually verify the unified timeline**

Using a disposable local tenant, perform login, navigation, password change, and one audited business action. Confirm the unified activity page shows the expected actor, action, channel, tenant, and correlation data. Verify a second tenant cannot see the first tenant's events.

- [ ] **Step 3: Update documentation**

Document the canonical table, channel rules, endpoint, backfill command, compatibility status of legacy tables, and the future mobile/system producer contract.

- [ ] **Step 4: Run final hygiene checks**

Run:

```bash
git diff --check
pnpm --filter @safari-shule/api exec tsc --noEmit
pnpm --filter @safari-shule/web typecheck
```

Expected: no whitespace errors, API typecheck succeeds, and web typecheck succeeds.
