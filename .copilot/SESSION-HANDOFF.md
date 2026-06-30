# Safari Shule — Session Handoff

> Last updated: 2026-06-30. Read this first if you're a fresh chat. Then read `.github/copilot-instructions.md` for the hard rules.

## What this project is

Kenyan multi-tenant school transport SaaS. Five modules:
1. **Custom Attribute Engine** — per-tenant dynamic fields on students/staff/parents/caretakers/vehicles.
2. **Fleet / Routes / Financials** — vehicles, fuel, repairs, insurance, routes (PostGIS), M-Pesa Daraja STK push.
3. **RFID Hardware Ingestion** — boarding scans + GPS pings via HMAC-signed requests.
4. **Trip Dispatch / Telemetry / Incidents** — live tracking via Socket.IO + Redis GEO, SOS workflow.
5. **Dispatch Communicator** — SMS via Africa's Talking, in-app notifications.

## Build status

- `pnpm --filter @safari-shule/api run build` → **exit 0**
- `pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json` → **exit 0**
- e2e suites have never been executed (no live docker run yet). They are written, typecheck cleanly, and are the next thing to validate.

## What's done (Phases 0–6 + Onboarding + TenantAdmin + Phase 10 scaffolding)

### apps/api modules implemented

| Module | Path | Notes |
|---|---|---|
| Auth | `src/auth/` | argon2id, JWT access (15m) + refresh (7d, `jti` reuse-detection) |
| Tenants resolution | `src/common/tenancy/` | Prisma client extension auto-injects `tenantId`; `withTenantSession()` for RLS |
| RBAC | `src/auth/permission.guard.ts` | Role + permission model, 60s Redis cache |
| Feature flags | `src/feature-flags/` | Per-`PlanTier` (basic/pro/enterprise), 60s Redis cache, quota limits |
| Custom Attributes | `src/modules/attributes/` | 300s Redis cache for definitions |
| People | `src/modules/profiles/` | students, staff, parents, caretakers, parent-student links |
| Fleet | `src/modules/fleet/` | vehicles + fuel + repairs + insurance |
| Routes | `src/modules/routes/` | PostGIS GIST indexes on bus stops; student-route assignment |
| Trips | `src/modules/trips/` | dispatch, telemetry, attendance events |
| Hardware | `src/modules/hardware/` | device registration with AES-256-GCM HMAC secrets; HMAC-SHA256 guard, ±5min replay window |
| Comms | `src/comms/` | Africa's Talking (mock mode for dev/test) |
| Payments | `src/modules/payments/` | M-Pesa Daraja STK push (mock mode for dev/test); status enum is `initiated\|succeeded\|failed\|cancelled` |
| Incidents | `src/modules/incidents/` | SOS endpoint with `persist` + `broadcast` + `sms` legs |
| Onboarding | `src/modules/onboarding/` | invitation + acceptance |
| Tenant Admin | `src/modules/tenant-admin/` | super-admin tenant provisioning |
| Telemetry | `src/modules/telemetry/` | live GPS via Redis GEOADD |
| Health | `src/modules/health/` | `/v1/health` liveness/readiness |
| Redis | `src/common/redis/` | global Nest provider exposing `client`, `get/set/del/ping` |

### Phase 10 scaffolding (just written, not yet executed)

- **`apps/api/prisma/seed.ts`** — Idempotent. Boots `NestFactory.createApplicationContext(AppModule)`. Creates `hillcrest` tenant via `TenantAdminService.createTenant({...planTier: 'pro'})`, then 6 role users, 3 vehicles, 2 routes with bus stops via raw `ST_MakePoint(...)::geography` SQL, 2 attribute definitions, 20 students with RFID tags + route assignments, 1 parent-student link for first 4 kids, 1 RFID device on vehicle #1 (printed apiKey + hmacSecret at end), 1 in-progress trip with 5 attendance events, 1 fuel log, 1 repair log.
- **`apps/api/test/`** — Jest e2e harness:
  - `jest-e2e.json` (testRegex `.e2e-spec\.ts$`, maxWorkers 1, testTimeout 30000)
  - `tsconfig.test.json` (extends api tsconfig, types: jest + node)
  - `helpers.ts` — `bootstrapTestApp`, `seedTenantWithRoles({withDevice?})`, `buildHardwareHeaders` (uses `Date.now()` milliseconds), `cleanupTenant`
  - `cross-tenant-isolation.e2e-spec.ts` (3 tests)
  - `permissions.e2e-spec.ts` (3 tests)
  - `feature-gating.e2e-spec.ts` (3 tests)
  - `hardware-hmac.e2e-spec.ts` (5 tests)
  - `sos.e2e-spec.ts` (2 tests)

## What's NOT done

1. **Run the e2e suite** against a real docker postgres+redis. Needs `make up` + `make db:migrate` first. Likely some adjustments to controller route paths or DTO field names will be needed.
2. **Root `README.md`** with end-to-end curl walkthrough (tenant bootstrap → login → invite → vehicle → route → trip → RFID scan → SOS → M-Pesa STK).
3. **Phase 7 — Web admin** (`apps/web`): Vite + React 18 + Tailwind + TanStack Query + Zustand + react-hook-form + react-leaflet. Pages enumerated in the original plan.
4. **Phase 8 — Flutter mobile** (`apps/mobile`): Riverpod + Dio + Hive (offline outbox) + Dart client generated from `/docs-json`. Three role shells: Driver, Parent, Assistant.
5. **Phase 9 — Observability**: Bull Board at `/admin/queues` (JWT + `tenants.manage`); Prometheus counters `safari_outbound_messages_total{channel,status}`, `safari_rfid_scans_total{result}`, `safari_mpesa_transactions_total{purpose,status}`.

## Key conventions (re-stated; see `.github/copilot-instructions.md` for the full set)

- Every `prisma.<model>.create()` needs explicit `tenantId: requireTenantId()`.
- `prisma.scoped` for reads; bypass only via `runWithBypass()`.
- Hardware timestamps are **milliseconds**, signature payload is `${deviceId}.${timestamp}.${rawBody}`.
- `Public()` decorator from `'../../auth/public.decorator'` exempts a route from JWT.
- `auth.issueTokenPair({id, tenantId, email, fullName})` returns `{accessToken, refreshToken, accessTtlSeconds, refreshTtlSeconds, user}`.
- Hardware GPS endpoint: `POST /v1/hardware/gps` body `{device_id, lat, lng, timestamp}`.
- Hardware RFID endpoint: `POST /v1/hardware/rfid-scan` body `{device_id, tag_uid, timestamp}`.

## Demo credentials (after `make db:seed`)

| Role | Email | Password |
|---|---|---|
| System admin | `admin@hillcrest.ac.ke` | `Demo!Password1` |
| Driver A / B, Assistant, Parent, Caretaker | see seed output | `Demo!Password1` |

The seed prints the generated RFID device `apiKey` and `hmacSecret` once at the end — capture them for curl/Postman demos.

## Known issues / things to verify on first run

- `IncidentEmergencyContact` field names used in `sos.e2e-spec.ts` are `{tenantId, label, phoneE164, priority}` — verify in `schema.prisma`.
- M-Pesa `initiate` route path may not be `/v1/payments/mpesa/initiate` — the test allows 403 or 404 to tolerate this.
- The SOS controller path is assumed `/v1/incidents/sos` — verify the actual decorator.
- Vehicle delete RBAC test assumes `delete` permission is denied for the `driver` role — confirm in the role-seed.

## Immediate next actions (in order)

1. `cd ~/Projects/me/safari-shule && make up && make db:migrate && pnpm --filter @safari-shule/api run test:e2e` — run the suite, fix any breakage iteratively.
2. Write root `README.md` with full curl walkthrough.
3. Start Phase 7 (`apps/web`).

## Git state

- Repo: `~/Projects/me/safari-shule/.git` (branch `main`)
- Author: `BonnieSpannah <bonifasohmn@gmail.com>` (per-repo `.git/config`)
- Initial commit: `2ad24e3` — "Initial commit: Safari Shule platform skeleton" (145 files)
- No remote configured yet. To add: `gh repo create BonnieSpannah/safari-shule --private --source=. --push`

## Where the prior chat lives

The chat that produced this commit ran in the `~/Projects/ogilvy/optimus/v2/core` VS Code workspace (a workspace-mismatch artifact — the real project is here). The full uncompacted transcript is at:

```
~/Library/Application Support/Code/User/workspaceStorage/787fee4d296e0494ad737ef1b5751def/GitHub.copilot-chat/transcripts/7f6ed4cd-6558-444d-a5b0-262668031093.jsonl
```

If you need exact code or error messages from earlier, read that JSONL.
