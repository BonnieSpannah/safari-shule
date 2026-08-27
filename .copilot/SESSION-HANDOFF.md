# Safari Shule — Session Handoff

> Last updated: 2026-08-27. Read this first if you're a fresh chat. Then read `.github/copilot-instructions.md` for the hard rules.

## What this project is

Kenyan multi-tenant school transport SaaS. Five modules:
1. **Custom Attribute Engine** — per-tenant dynamic fields on students/staff/parents/caretakers/vehicles.
2. **Fleet / Routes / Financials** — vehicles, fuel, repairs, insurance, routes (PostGIS), M-Pesa Daraja STK push.
3. **RFID Hardware Ingestion** — boarding scans + GPS pings via HMAC-signed requests.
4. **Trip Dispatch / Telemetry / Incidents** — live tracking via Socket.IO + Redis GEO, SOS workflow.
5. **Dispatch Communicator** — SMS via Africa's Talking, in-app notifications.

## Build status

- `pnpm --filter @safari-shule/api run build` → **exit 0**
- `pnpm --filter @safari-shule/api exec tsc --noEmit` → **exit 0**
- `pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json` → **exit 0**
- `pnpm --filter @safari-shule/web run typecheck` → **exit 0**
- e2e suite: **green** — last ran against `make infra` + `make db-migrate` (PostGIS 16 + Redis 7). All 13 spec files pass.

## Milestone completion status

| Milestone | Status | Notes |
|---|---|---|
| M1 — Auth + Tenancy + RBAC skeleton | ✅ done | |
| M2 — Back-office portal (Students, Fleet, Routes, Parents, Settings) | ✅ done | |
| M3 — Stabilize + e2e green | ✅ done | DataTable v3 + export; e2e suite passing |
| M4 — Web admin MVP | ✅ done | All admin pages wired; Prometheus metrics, DNC, Bull Board, audit event sink committed |
| M5 — CI/CD hardening | 🔶 in progress | See "M5 remaining" below |
| M6 — QuickStart docs | ❌ not started | |
| M7 — Flutter mobile | ❌ not started | |

## What's done — apps/api

All modules implemented, tested, and building:

| Module | Path |
|---|---|
| Auth (argon2id, JWT 15m/7d, jti) | `src/auth/` |
| Multi-tenancy (Prisma scoped + RLS) | `src/common/tenancy/` |
| RBAC + PermissionGuard | `src/rbac/` |
| Feature flags + plan tiers | `src/feature-flags/` |
| Custom Attribute Engine | `src/modules/attributes/` |
| People (students, staff, parents, caretakers) | `src/modules/profiles/` |
| Fleet (vehicles, fuel, repairs, insurance) | `src/modules/fleet/` |
| Routes (PostGIS, stops, assignments) | `src/modules/routes/` |
| Trips (dispatch, telemetry, attendance) | `src/modules/trips/` |
| Hardware (RFID + GPS, HMAC) | `src/modules/hardware/` |
| Comms (Africa's Talking, DNC check, mock mode) | `src/comms/` |
| Payments (M-Pesa Daraja STK, mock mode) | `src/modules/payments/` |
| Incidents / SOS (Socket.IO + Redis GEO) | `src/modules/incidents/` |
| Onboarding (invite + accept) | `src/modules/onboarding/` |
| Tenant Admin (super-admin provisioning) | `src/modules/tenant-admin/` |
| Audit log + Dashboard stats | `src/audit/`, `src/modules/dashboard/` |
| Prometheus metrics (MetricsModule) | `src/common/metrics/` |
| Seed (hillcrest demo tenant) | `prisma/seed.ts` |

e2e spec files (all passing): `cross-tenant-isolation`, `permissions`, `feature-gating`, `hardware-hmac`, `sos`, `trips`, `identity-lifecycle`, `users-management`, `rfid-devices`, `audit-and-dashboard`, `audit-events`, `bull-board`, `comms-dnc`, `platform-super-admin`, `payments`.

## What's done — apps/web

All admin pages are wired (no `PlaceholderPage` remaining in router):

| Page | Path |
|---|---|
| Login / Forgot / Reset / Activate | `src/routes/` |
| Dashboard + Live trips map card | `src/routes/DashboardPage.tsx`, `LiveTripsMapCard.tsx` |
| Platform admin (tenants list + detail) | `src/routes/platform/` |
| Students, Fleet, Routes | `src/routes/students/`, `fleet/`, `routes/` |
| Parents, Settings (Users + Staff) | `src/routes/parents/`, `settings/` |
| Trips | `src/routes/trips/TripsPage.tsx` |
| Hardware (RFID devices) | `src/routes/hardware/HardwarePage.tsx` |
| Audit log | `src/routes/audit/AuditPage.tsx` |
| Incidents | `src/routes/incidents/IncidentsPage.tsx` |
| Payments / M-Pesa | `src/routes/payments/PaymentsPage.tsx` |
| Profile / Preferences / Security | `src/routes/me/` |

DataTable v3 in place across all list pages: column filters, bulk selection, CSV/Excel/PDF export.

## What's done — CI/CD (.github/workflows/)

| Workflow | Trigger | Status |
|---|---|---|
| `ci.yml` | PR + push:main | ✅ done |
| `codeql.yml` | PR + push:main + weekly | ✅ done |
| `dependency-review.yml` | PR | ✅ done |
| `db-migration-check.yml` | PR touching prisma/ | ✅ done |
| `build-image.yml` | push:main + tags | ✅ done |
| `release-please.yml` | push:main | ✅ done |
| `mutation-weekly.yml` | weekly Mon 04:00 UTC | ✅ done |
| `project-automation.yml` | PR + issue events | ✅ done |
| `deploy-dev.yml` | — | ❌ not yet |
| `preview-pr.yml` | — | ❌ not yet |
| `promote-staging.yml` | — | ❌ not yet |
| `promote-production.yml` | — | ❌ not yet |
| `rollback.yml` | — | ❌ not yet |

Release-please config: `release-please-config.json` + `.release-please-manifest.json` at repo root.
Path-based PR labeler: `.github/labeler.yml`.

## M5 remaining (next session's work)

1. **Husky + commitlint + lint-staged** — local DX: block bad commits before CI sees them.
2. **`deploy-dev.yml`** — auto-deploy merged digest to dev env after `build-image.yml` succeeds.
3. **`preview-pr.yml`** — ephemeral preview URL per PR; teardown on close.
4. **`promote-staging.yml`** — manual FF `main`→`staging`; deploy same digest.
5. **`promote-production.yml`** — env approval gate; FF `staging`→`production`; tag + GitHub Release.
6. **`rollback.yml`** — `workflow_dispatch` rollback to a previous image digest.
7. **Branch protection script** — `gh api` calls to enforce required checks, PR reviews, linear history on `main`.

Branch convention: create `feature/m5-husky-deploy-workflows` from `main` before starting.

## Key conventions (see `.github/copilot-instructions.md` for the full set)

- Every `prisma.<model>.create()` needs explicit `tenantId: requireTenantId()`.
- `prisma.scoped` for reads; bypass only via `runWithBypass()`.
- Hardware timestamps are **milliseconds**; signature payload is `${deviceId}.${timestamp}.${rawBody}`.
- `Public()` decorator from `'../../auth/public.decorator'` exempts a route from JWT.
- `INTEGRATIONS_MODE=mock` short-circuits Africa's Talking + M-Pesa — never call live from tests.

## Demo credentials (after `make db:seed`)

| Role | Email | Password |
|---|---|---|
| System admin | `admin@hillcrest.ac.ke` | `Demo!Password1` |
| Driver A / B, Assistant, Parent, Caretaker | see seed output | `Demo!Password1` |

The seed prints the generated RFID device `apiKey` and `hmacSecret` once at the end — capture them for curl/Postman demos.

## Git state

- Repo: `github.com/BonnieSpannah/safari-shule` (private)
- Local: `~/Projects/me/safari-shule`
- Branch: `main` — only branch; all feature branches deleted
- HEAD: `00e772f` — `ci(m5): add security & governance workflows`
- Remote: `origin/main` in sync with local `main`
