# Safari Shule — Roadmap Design

> Last reviewed: 2026-08-11. Re-confirm before deviating from phase order.

## What this platform is

Kenyan multi-tenant school transport SaaS. One NestJS API, one React web admin, one Flutter mobile app (planned). Single shared PostgreSQL database with row-level tenant isolation. Five core modules: custom attributes, fleet/routes/financials, RFID hardware ingestion, trip dispatch/telemetry/incidents, and communications.

## Current status snapshot (2026-08-11)

### Backend API — complete
All core modules are built, typecheck-clean, and passing `pnpm build`. The e2e suite (13 spec files, ~40 tests) has never been executed against a live database.

| Module | Status |
|---|---|
| Auth (argon2id, JWT 15m/7d, jti) | ✅ |
| Multi-tenancy (Prisma scoped + RLS) | ✅ |
| RBAC + PermissionGuard | ✅ |
| Feature flags + plan tiers | ✅ |
| Custom Attribute Engine | ✅ |
| People (students, staff, parents, caretakers) | ✅ |
| Fleet (vehicles, fuel, repairs, insurance) | ✅ |
| Routes (PostGIS, stops, assignments) | ✅ |
| Trips (dispatch, telemetry, attendance) | ✅ |
| Hardware ingestion (RFID + GPS, HMAC) | ✅ |
| Comms (Africa's Talking, mock mode) | ✅ |
| Payments (M-Pesa Daraja STK, mock mode) | ✅ |
| Incidents / SOS (Socket.IO + Redis GEO) | ✅ |
| Onboarding (invite + accept) | ✅ |
| Tenant Admin (super-admin provisioning) | ✅ |
| Audit log + Dashboard stats | ✅ |
| Seed (hillcrest demo tenant) | ✅ |

### Web admin (apps/web) — M1–M3 in progress, branch `feature/m3-live-trips-dashboard`

| Screen | Status |
|---|---|
| Auth flow (login, forgot, reset, activate) | ✅ |
| Layout shell + routing | ✅ |
| Platform admin (tenants list + detail) | ✅ |
| Students, Fleet, Routes, Settings, Parents | ✅ |
| Trips page | ✅ |
| Hardware (RFID devices) | ✅ |
| Audit log + Dashboard stats | ✅ |
| DataTable v3 (filters, bulk select, CSV/Excel/PDF export) | ✅ uncommitted |
| Live trips map (react-leaflet, Socket.IO WS feed) | ❌ |
| Payments / M-Pesa screen | ❌ |
| Incidents screen | ❌ |

### Infrastructure / DevOps
- Docker Compose (postgres, redis, mailhog): ✅
- Prisma migrations (14+): ✅
- GitHub Actions (13 planned workflows): ❌ none exist
- Branch protection / CODEOWNERS: ❌
- Husky + commitlint: ❌

### Missing entirely
- Mobile app (Flutter) — `apps/mobile/` does not exist
- Finance / Accounting module
- Observability (Bull Board, Prometheus counters, Grafana)
- Government integrations (eTIMS, NEMIS, NTSA)
- HR module

---

## Roadmap (fastest shippable path)

### M3 — Stabilize & close the current branch *(immediate)*

**Goal:** Green e2e suite against live docker-compose, DataTable work committed, branch merged to `main`.

Key deliverables:
- Commit 9 modified web files (DataTable v3 + export + funnel toggle)
- Boot `make infra && make db-migrate` and run `pnpm test:e2e` for the first time
- Fix the 4 known issues from SESSION-HANDOFF.md (IncidentEmergencyContact fields, M-Pesa route, SOS path, driver RBAC)
- Fix any additional failures surfaced by the first run
- Squash-merge `feature/m3-live-trips-dashboard` → `main`

DoD: `make infra && make db-migrate && pnpm --filter @safari-shule/api run test:e2e` exits 0; `pnpm build` exits 0.

---

### M4 — Complete the web admin MVP *(~1–2 weeks)*

**Goal:** Every core admin journey works in the browser. No `PlaceholderPage` remaining.

Key deliverables:
- Live trips map (react-leaflet canvas, real-time Socket.IO WS, vehicle pins, boarding state)
- Incidents screen (SOS alert list + detail, resolve workflow, SMS log)
- Payments screen (M-Pesa STK initiation, transaction history, status badges)
- Governance runtime: `POST /v1/audit/events` client-event sink; DNC check in CommunicationsService
- Prometheus counters: `safari_outbound_messages_total`, `safari_rfid_scans_total`, `safari_mpesa_transactions_total`
- Bull Board at `/admin/queues` behind JWT + `tenants.manage`

DoD: all web pages have happy path + empty state + error state + loading state; no PlaceholderPage.

---

### M5 — CI/CD + Developer Experience *(~1 week)*

**Goal:** Every push is checked; every merge is shippable.

Key deliverables:
- Husky + commitlint + lint-staged
- 13 GitHub Actions workflows (ci.yml, build-image.yml, deploy-dev.yml, preview-pr.yml, promote-staging.yml, promote-production.yml, release-please.yml, rollback.yml, db-migration-check.yml, mutation-weekly.yml, codeql.yml, dependency-review.yml, project-automation.yml)
- Branch protection scripted via `gh api`
- CODEOWNERS (auth/, payments/, hardware/, prisma/ require 2nd approver)
- Cosign + syft SBOM + trivy in build pipeline
- Release-please + auto-changelog
- Herd wiring (`*.safari-shule.test` DNS + mkcert TLS)

DoD: PR to `main` runs CI end-to-end; merged commit auto-deploys to dev env; `gh workflow run rollback.yml` works.

---

### M6 — QuickStart Documentation + Demo Readiness *(~3–4 days)*

**Goal:** A school IT person can clone the repo, run it, and log in unassisted.

Key deliverables:
- `docs/quickstart/install-mac.md`
- `docs/quickstart/first-run.md`
- `docs/e2e-walkthrough.md` (curl/HTTPie full story)
- `docs/user-guide/admin.md`

DoD: Someone following the docs cold reaches the login page and sees seeded hillcrest data.

---

### M7 — Flutter Mobile App *(~3–4 weeks)*

**Goal:** Driver app + Parent app working on Android (and iOS simulator).

Key deliverables:
- Auth (JWT + biometric unlock) for all three shells (Driver, Parent, Assistant)
- Driver: start/end shift, live trip map + boarding list, SOS (works offline, buffered)
- Parent: live bus location for my child, push notifications (FCM)
- Assistant: mark boarding/alighting (RFID scan + QR fallback)
- Offline outbox (Hive) for Driver + Assistant
- Dart API client generated from OpenAPI spec
- Signed AAB deployed to Play Store (internal track)

DoD: Driver starts trip, Assistant scans RFID, Parent sees live pin, SOS triggers web admin alert.

---

### M8 — Finance & Fee Collection *(~2–3 weeks)*

**Goal:** Schools can invoice parents, collect via M-Pesa, and see a P&L.

Key deliverables:
- Chart of Accounts (IFRS-lite, Kenya school template)
- Fee structures per class/route
- Invoice generation + parent statement (PDF + email)
- M-Pesa STK initiated from invoice; daily reconciliation BullMQ job
- Trial balance + P&L + cash flow reports (API + web)
- Journal entries auto-posted on every business event

DoD: Parent receives invoice email → pays M-Pesa STK → admin sees reconciled transaction → P&L updates.

---

### M9 — Testing completeness *(interwoven; hardened here)*

Key targets:
- E2e suite 100% passing
- Vitest coverage ≥ 80% globally; ≥ 95% on auth/, payments/, hardware/
- Playwright e2e web (login → live trip → SOS)
- Stryker mutation testing weekly (CI)
- Contract tests from OpenAPI + Zod

---

### M10 — Government & Statutory Integrations *(~3 weeks)*

NEMIS UPI, NTSA vehicle compliance, driver license/PSV badge tracking, eTIMS receipt transmission, PAYE/NHIF/NSSF/Housing Levy calculators, P10/NSSF-3/SHIF/Housing Levy CSV exports.

---

### M11 — HR Module *(~2 weeks)*

Employment contracts, leave management (Employment Act 2007), disciplinary log, appraisals, payslips (PDF/A), payroll run with two-eyes approval + M-Pesa B2C.

---

### M12 — Observability, DR & SOC-2 Posture *(~1–2 weeks)*

Grafana dashboards, GlitchTip/Sentry end-to-end, SLSA level 3, backup DR runtime (BullMQ workers), monthly restore drill automated, SOC-2 CC1–CC9 control matrix.

---

### M13 — Public Launch

Marketing site, self-service tenant onboarding, public status page, first 25 live tenants, SOC-2 Type I.

---

### M14 — Regional Expansion

Uganda / Tanzania / Rwanda statutory variants, multi-currency, French UI, local data residency.

---

## Priority sequence

```
M3 (stabilize now)
  → M4 (complete web MVP)
    → M5 (CI/CD)
      → M6 (docs + demo)
        → M7 (mobile)
          → M8 (finance + revenue)
            → M9 (test hardening)
              → M10/M11/M12 (compliance + HR + observability)
                → M13/M14 (launch + expand)
```

**First shippable demo milestone:** end of M6 (API + web admin + docs + CI green + one-command setup).
**First revenue-ready milestone:** end of M8 (invoice → M-Pesa → reconciliation).
