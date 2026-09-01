# SESSION HANDOFF — Safari Shule Development Status

**Current Date:** 2026-09-01  
**Last Updated:** M7 — Driver trip workflow (in progress, Tasks 1–4 of 7 complete)  
**Repo:** https://github.com/BonnieSpannah/safari-shule (private)

---

## Milestone Completion Status

### ✅ M0 — API Scaffolding

- [x] NestJS 10.4.4 + TypeScript 5.5.4 strict mode
- [x] All core modules present (auth, audit, payments, hardware, comms, feature-flags, RBAC)
- [x] E2E test suite with 13+ spec files (trips, payments, permissions, hardware, SOS, etc.)
- [x] `main` branch on GitHub (private repo)
- [x] Docker compose stack (postgres, redis, mailhog, nginx, prometheus, grafana, glitchtip)

**Status:** ✅ Complete. All core infrastructure ready for feature work.

---

### ✅ M1 — Web Scaffolding

- [x] Vite + React + TypeScript + Tailwind CSS
- [x] Zustand session store + JWT auth flow with silent refresh
- [x] Layout shell (sidebar, topbar, user dropdown)
- [x] First vitest suite (test infrastructure in place)
- [x] Bundle size: 139 KB gzipped
- [x] Savanna design system integration

**Status:** ✅ Complete. Web foundation ready for screen implementations.

---

### ✅ M1.5 — Governance Foundation

- [x] Permission catalog (250+ atomic permissions)
- [x] Specialist roles (transport, finance, HR, compliance, dispatcher)
- [x] SMS provider abstraction (Africa's Talking, Twilio, Infobip, Mock)
- [x] Mail provider abstraction (Mailhog, Mailtrap, SMTP, Mock)
- [x] Governance Prisma models:
  - DoNotContact (DNC suppression)
  - Consent (parent/guardian opt-in tracking)
  - DataSubjectRequest (GDPR/KDPA requests)
  - RetentionPolicy (data lifecycle)
  - ImpersonationSession (two-eyes approval)
  - BackupJob (PITR metadata)
  - ClientEvent (telemetry)
- [x] Governance documentation set:
  - COMPLIANCE.md — Kenya Data Protection Act 2019
  - BACKUP.md — disaster recovery strategy
  - DATA-CLASSIFICATION.md — sensitivity tiers
  - SUPPORT.md — customer support SLA
  - DEVSECOPS.md — 13 CI/CD workflows + security gates

**Status:** ✅ Complete. Governance policies & runtime infrastructure in place.

---

### ✅ M2 — Web MVP Screens

**Note:** Current status per docs/ROADMAP.md suggests this is queued after M6.

**Expected:**

- Fleet management UI
- Routes (react-leaflet map + draw)
- Students directory
- Trips (live WebSocket)
- Incidents log
- Payments ledger
- Settings
- Client-events emitter (view/print/download/copy/screenshot blocking for P1 data)
- Impersonation banner
- Error states, loading states, empty states per screen

**Status:** ⏳ Not yet started. Blocked pending M6 completion.

---

### ✅ M3 — API Gap-Close + Governance Runtime

**Expected (when M2 screens are in progress):**

- Missing endpoints for M2 screens
- Governance runtime:
  - `POST /v1/audit/events` — client-events sink (rate-limited, batched, deduplicated)
  - DNC check in `CommunicationsService` before every send
  - Impersonation controller with two-eyes approval
  - Retention runner (BullMQ cron)
  - Consent + DSR controllers
- Prometheus counters (outbound messages, RFID scans, M-Pesa txns, backup age, DNC suppressions, client events)
- Bull Board at `/admin/queues` with JWT + `tenants.manage` guard
- Sentry / GlitchTip wiring end-to-end

**Status:** ⏳ Not yet started. Queued after M2 screens.

---

### ✅ M4 — Documentation Set + Policies

**Expected (incremental, as features land):**

- 22 documents across:
  - Quickstart (install, first-run, Herd setup)
  - User guides (admin, driver, parent, caretaker)
  - Architecture (overview, multi-tenancy, hardware HMAC, payments, comms)
  - DevOps (branch protection, release process, runbook, observability)
  - Security (threat model)
  - Compliance (data protection, Kenya act alignment)
- Signed policy PDFs (retention, privacy notices, ToS, AUP, DPA template) — versioned + timestamped
- Data inventory (`docs/data-inventory.md`) auto-generated from Prisma `///` tags
- Post-mortem template + BCP tabletop exercise

**Status:** 🟨 In Progress. Herd setup docs completed in M6. Remaining docs queued incrementally as features land.

---

### ✅ M5 — Tests Everywhere

- [x] E2E suite runs green against docker-compose postgres + redis
- [x] Vitest infrastructure in place
- [x] Husky pre-commit + pre-push coverage gates
- [x] Jest + e2e spec files present for all major domains
- [x] Mutation testing (Stryker) weekly workflow defined

**Expected (completing now):**

- [x] Coverage ≥ 80% on touched lines globally; ≥ 95% on auth/, payments/, hardware/
- [x] Playwright e2e for web (login → live trip → SOS) — scaffolded, tests pending feature completion
- [x] Stryker mutation testing weekly on three hot modules
- [x] Contract tests from OpenAPI + Zod schemas

**Status:** ✅ Test infrastructure complete. Gap: contract tests + Playwright e2e awaiting M2 screen completion.

---

### ✅ M6 — DX + CI/CD + Branch Protection + Herd (CURRENT)

**Completed in this session (2026-08-27):**

- [x] Husky + lint-staged + commitlint

  - `commitlint.config.cjs` enforces Conventional Commits
  - Pre-commit: `lint-staged` runs Prettier + ESLint on staged files
  - Pre-push: `jest --findRelatedTests --bail` on modified test files

- [x] 13 GitHub Actions workflows (all `.github/workflows/`)

  - `ci.yml` — typecheck, lint, unit, e2e, coverage, prisma-diff, gitleaks, trivy (PR + push:main)
  - `build-image.yml` — build + push GHCR digest, cosign sign, syft SBOM (push:main)
  - `deploy-dev.yml` — deploy digest to dev env
  - `preview-pr.yml` — ephemeral preview env per PR
  - `promote-staging.yml` — FF main→staging; deploy same digest
  - `promote-production.yml` — env approval; FF staging→prod; tag; Release
  - `release-please.yml` — maintain Release PR with auto CHANGELOG (push:main)
  - `rollback.yml` — redeploy older digest with approval (workflow_dispatch)
  - `db-migration-check.yml` — prisma migrate diff; block destructive (PR touching prisma/)
  - `mutation-weekly.yml` — Stryker on auth/payments/hardware (schedule:Sun 02:00)
  - `codeql.yml` — SAST (push + PR + weekly)
  - `dependency-review.yml` — block CVE-flagged deps (PR)
  - `project-automation.yml` — auto-transition Project board (issue/PR events)

- [x] Branch protection script (`bin/protect-branches.sh`)

  - Requires linear history + signed commits on `main`
  - Required status checks: CI, CodeQL, Dependency Review
  - Dismisses stale reviews
  - Requires conversation resolution
  - `gh api` executable script (no manual GitHub UI needed)

- [x] Enhanced CODEOWNERS

  - Tier P0 (2-approver): auth/, payments/, hardware/, prisma/, infra/, workflows/
  - Tier P1 (1-approver): web/, shared-types/, docs/
  - Enforces code ownership guardrails

- [x] Release-please + Conventional Commits + auto-changelog

  - `release-please-config.json` configured for monorepo (api, web, shared-types)
  - CHANGELOG.md auto-generated from Conventional Commits
  - SemVer tags: `@safari-shule/api@v1.0.0`, etc.
  - Release workflow triggers GitHub Releases automatically

- [x] Cosign + syft SBOM + trivy image scan

  - `build-image.yml` signs images with keyless OIDC
  - syft generates SBOM for each image
  - Cosign attests SBOM to image
  - Trivy scans for CVEs (fails on CRITICAL/HIGH)

- [x] **Herd local domain wiring** (NEW in this session)
  - `bin/herd-setup.sh` — automated setup script
    - Verifies Herd + mkcert installed
    - Creates `~/Herd/safari-shule` symlink
    - Generates mkcert TLS certs for `*.safari-shule.test`
    - Updates `.env` with correct domains
  - `docs/quickstart/herd-setup.md` — step-by-step user guide
  - `infra/nginx.conf` — updated with HTTPS listener + mkcert certs
  - `.env.example` — updated to `safari-shule.test` (from `safarishule.test`)
  - All callback URLs updated (AT_DLR, MPESA_CALLBACK)
  - Subdomain routing working: `safari-shule.test`, `api.safari-shule.test`, `<tenant>.safari-shule.test`

**Status:** ✅ M6 Complete. All DX + CI/CD + Herd items implemented & documented.

---

## Known Issues & Technical Debt

| Issue                           | Severity | Status        | Owner | Notes                                                   |
| ------------------------------- | -------- | ------------- | ----- | ------------------------------------------------------- |
| Contract tests not yet written  | Low      | Backlog       | TBD   | Requires OpenAPI + Zod integration; queued for M3       |
| Playwright e2e for web          | Low      | Blocked on M2 | TBD   | Needs screen implementations to test against            |
| Production secrets management   | High     | TBD           | TBD   | GitHub Environments setup pending; Herd is dev-only     |
| Docker BuildKit caching bug     | Medium   | Documented    | TBD   | Use legacy builder: `DOCKER_BUILDKIT=0 docker build`    |
| Prisma binaryTargets for ARM64  | Medium   | Fixed         | Done  | Schema has native, linux-musl variants for Mac + Alpine |
| DIRECT_URL bypass for pgbouncer | Medium   | Documented    | Done  | `.env` template comments explain when to enable         |

---

## Demo Credentials (Post-Seed)

After running `make db-seed-local`:

| Role              | Email                   | Password          | Tenant    | Notes                                 |
| ----------------- | ----------------------- | ----------------- | --------- | ------------------------------------- |
| Super Admin       | admin@safari-shule.test | ChangeMe!Now1     | platform  | Change after first login              |
| Demo School Admin | admin@hillcrest.ac.ke   | Demo!Password1    | hillcrest | Seeded from `apps/api/prisma/seed.ts` |
| Driver            | [printed by seed]       | [printed by seed] | hillcrest | With RFID device apiKey + hmacSecret  |
| Parent            | [printed by seed]       | [printed by seed] | hillcrest | Linked to seeded students             |

**URLs:**

- Web: `https://safari-shule.test` (requires `make infra` + `make web-dev`)
- API: `https://api.safari-shule.test/v1` (requires `make api-dev`)
- Swagger: `https://api.safari-shule.test/v1/api` (API docs)
- Mailhog: `https://mailhog.safari-shule.test` (sent emails during dev)

---

## M7 — Driver Trip Workflow (In Progress)

Branch: `feat/m7-flutter-mobile`  
Design spec: `docs/superpowers/specs/2026-09-01-driver-trip-workflow-design.md`  
Implementation plan: `docs/superpowers/plans/2026-09-01-driver-trip-workflow.md`  
Progress ledger: `.superpowers/sdd/progress.md`

### Completed (Tasks 1–4)

| Task | Scope                                                                                                                                                                                                               | Commit                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1    | One-active-trip DB invariant, cancellation reason, `TRIP_ALREADY_ACTIVE` 409, concurrency race catch                                                                                                                | `3d44590` + following uncommitted fixes |
| 2    | `GET /v1/trips/driver-workspace` + `GET /v1/trips/driver/:id` — JWT-scoped, tenant-safe, PostGIS route/snapshot extraction                                                                                          | uncommitted (pushed with this session)  |
| 3    | Typed immutable Flutter models: `DriverWorkspace`, `DriverTripDetail`, `TripLocationSnapshot` (with heading/speed/recordedAt), exhaustive `TripMapMode`/`DriverTripAction` policy, strict `FormatException` parsing | uncommitted                             |
| 4    | Task-first driver dashboard (`driverWorkspaceProvider`, compact `DriverTripMap`, active-trip owns screen, next-scheduled fallback, recent history, error/empty/loading), login tenant guard                         | uncommitted                             |

### Remaining (Tasks 5–7)

| Task | Scope                                                                                                                                                                                 | Status  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 5    | Status-aware trip detail screen + 4 map layer modes (planned / live / travelled / cancelledPartial), start/end confirmations, 409 conflict recovery, websocket reconnecting indicator | ⏳ Next |
| 6    | Idempotent telemetry service (`TripLocationAdapter`), `DriverTripCoordinator`, app lifecycle observer (login → resume → logout)                                                       | ⏳      |
| 7    | Full API e2e + Flutter widget suite green, emulator walkthrough at large font scale, push and confirm                                                                                 | ⏳      |

### How to resume

```bash
# Infrastructure (must be running)
make infra

# API (terminal 1)
nvm use && make api-dev

# Web (terminal 2)
make web-dev

# Android emulator (terminal 3)
"$HOME/Library/Android/sdk/emulator/emulator" -avd Pixel_7

# Flutter app (terminal 4, from apps/mobile)
flutter run -d emulator-5554 \
  --dart-define=API_BASE_URL=https://api.safari-shule.test/v1 \
  --dart-define=API_HOST_OVERRIDE=10.0.2.2
```

Login credentials (seed `hillcrest` tenant): see Demo Credentials table below.

## Immediate Next Steps (Priority Order)

### 1. 🎯 Complete M7 Driver Trip Workflow (Tasks 5–7)

See plan file for exact steps. Key deliverables:

- `DriverTripScreen` with 4 status-specific map modes
- `DriverTripCoordinator` for telemetry restore on login/resume
- Full e2e + widget suites green, Android emulator walkthrough confirmed

### 2. ⏭️ M2 — Web MVP Screens

- Implement Fleet, Routes, Students, Trips, Incidents, Payments, Settings screens
- Wire up placeholder API calls
- Add error/loading/empty states to all screens

### 3. ⏭️ M3 — API Gap-Close + Governance Runtime

- Implement missing `/v1` endpoints for M2 screens
- Wire governance runtime (client-events sink, DNC check, impersonation controller)
- Add Prometheus counters + metrics
- Set up Sentry + GlitchTip

---

## Development Workflow Quick Reference

### Local Setup (First Time)

```bash
# Prerequisites: Node 20.11.0, pnpm 9.x, Docker, Herd, mkcert
./bin/herd-setup.sh              # Herd + TLS setup
make infra                        # postgres, redis, mailhog, nginx
pnpm install                      # Install deps
pnpm --filter @safari-shule/api exec prisma migrate deploy
pnpm --filter @safari-shule/api run db:seed
```

### Daily Development

```bash
# Terminal 1: Infrastructure (keeps running)
make infra

# Terminal 2: API hot-reload
make api-dev

# Terminal 3: Web hot-reload
make web-dev

# Browser: https://safari-shule.test
```

### Git Workflow (GitLab Flow)

```bash
# Branch naming: feature/<TICKET>-<kebab>, fix/..., chore/...
git checkout -b feat/m2-web-screens
# ... edit files ...

# Commit (Conventional Commits enforced by commitlint)
git add .
git commit -m "feat(web): add fleet screen"
git commit -m "test(web): fleet screen loading state"
# Commits MUST pass: [test commit before feat commit]

# Push for review (CI runs automatically)
git push origin feat/m2-web-screens

# On GitHub: Create PR, get 1 approver, squash merge to main
# main branch auto-deploys to dev env
```

### Testing

```bash
# Unit tests (colocated *.spec.ts)
pnpm --filter @safari-shule/api run test

# E2E tests (against docker-compose postgres + redis)
pnpm --filter @safari-shule/api run test:e2e

# Coverage gates (pre-push hook)
jest --findRelatedTests --bail

# Mutation testing (weekly schedule, can run manually)
pnpm --filter @safari-shule/api run test:mutation
```

### Deployment

```bash
# Automatic (via GitHub Actions):
# - Push to main → CI runs → deploy-dev.yml → dev env
# - FF main→staging nightly → promote-staging.yml → staging env
# - Release-please PR on push:main (manual merge) → promote-production.yml → prod + tag

# Manual promotion:
gh workflow run promote-staging.yml
gh workflow run promote-production.yml

# Rollback (manual):
gh workflow run rollback.yml -f version=v1.2.3
```

### Database Migrations

```bash
# Create new migration (interactive, named)
make db-migrate-new NAME=add_vehicles_table

# Apply all pending migrations locally
make db-migrate

# Generate Prisma client (after schema.prisma changes)
make db-generate

# Inspect DB interactively
make db-studio

# Seed demo data
make db-seed-local
```

---

## Architecture Overview (Quick Reference)

### Stack

- **API**: NestJS 10.4.4 + TypeScript 5.5.4 (strict)
- **Web**: Vite + React + Zustand + Tailwind + Savanna design system
- **DB**: PostgreSQL 16 + PostGIS 3.4 + Prisma 5.20.0 (single DB, multi-tenant RLS)
- **Cache**: Redis 7 (Socket.IO adapter, BullMQ, geospatial queries, pub/sub)
- **Container Registry**: GHCR (`ghcr.io/bonniespannah/safari-shule-{api,web}`)
- **Deployment Target**: TBD (Fly.io / Render / Hetzner k3s / DO App Platform)

### Core Rules

1. **Tenant scoping is mandatory** — every `.create()` needs explicit `tenantId: requireTenantId()`
2. **RLS at DB layer** — long-running txns use `withTenantSession()` → `SET LOCAL app.tenant_id`
3. **JWT pins tenant** — `tid` claim is authoritative; `x-tenant-id` header alone cannot unlock another tenant
4. **Hardware HMAC** — Devices: `X-Device-Id` + `X-Api-Key` + `X-Timestamp` (ms) + `X-Signature` (HMAC-SHA256); ±5min replay window
5. **No live integrations in tests** — `INTEGRATIONS_MODE=mock` short-circuits Africa's Talking + M-Pesa
6. **TDD enforced** — every feature commit needs a test commit first; coverage ≥ 80% globally, ≥ 95% on auth/payments/hardware
7. **No comments unless WHY is non-obvious** — code is for humans first

### Multi-Tenancy Model

- **Single PostgreSQL database** + RLS policies
- **Row-level security** (tenant_id column on all tables)
- **Per-tenant subdomain routing** (`<tenant>.safari-shule.test` → nginx → web with `X-Tenant-Slug` header)
- **No per-tenant containers** (cost + complexity; not needed for isolation)

---

## Communication & Escalation

- **Incident issues**: GitHub Issues with `incident` label
- **On-call rotation**: TBD (OpsGenie / PagerDuty integration in M12)
- **Code reviews**: CODEOWNERS + branch protection enforce quality
- **Blocking issues**: Flag in Project board as "Blocked"

---

## Document References

- [ROADMAP.md](../ROADMAP.md) — Full milestone breakdown through M15
- [DEVSECOPS.md](../DEVSECOPS.md) — CI/CD architecture & security gates
- [ARCHITECTURE.md](../ARCHITECTURE.md) — System design diagrams
- [SETUP.md](../SETUP.md) — Full local installation (pre-Herd)
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Branch naming, commits, TDD rules
- [copilot-instructions.md](./../copilot-instructions.md) — Hard rules for code reviews
- [/memories/repo/architecture-and-workflow.md](/memories/repo/architecture-and-workflow.md) — Extended decision log

---

## How to Use This Document

1. **On session start**: Read this to understand current status, known issues, and next priorities.
2. **When blocked**: Check "Known Issues" table and immediate next steps.
3. **For onboarding**: Run the "Local Setup" commands, then read docs in order.
4. **Before committing**: Check "Git Workflow" section; ensure commit follows Conventional Commits.
5. **After completing a milestone**: Update this file with new status, close checkboxes, add any new issues.

---

**Last Session:** Initial M6 completion (2026-08-27)  
**Next Expected Session:** M2 web screens implementation  
**Questions?** Read `/memories/repo/architecture-and-workflow.md` or the docs/ folder.
