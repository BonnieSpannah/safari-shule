# Roadmap — Safari Shule

Sequenced milestones from now to production-ready SaaS ERP for Kenyan schools. Every milestone ends with `pnpm build` green, tests green, one atomic commit, and pushed to `main`.

## Where we are today (2026-07-09)

- ✅ **M0** — API scaffolded (all core modules), e2e suites written, `main` on GitHub
- ✅ **M1** — Web scaffold (Vite + React + TS + Tailwind + Savanna design system), auth flow with silent JWT refresh, Zustand session, layout shell, first vitest suite green, 139 KB gz bundle
- ✅ **M1.5 (governance foundation)** — Full permission catalog (250+ atomic permissions), specialist roles (transport, finance, HR, compliance, dispatcher), SMS provider abstraction (AT / Twilio / Infobip / Mock), mail provider abstraction (Mailhog / Mailtrap / SMTP / Mock), governance Prisma models (DoNotContact, Consent, DataSubjectRequest, RetentionPolicy, ImpersonationSession, BackupJob, ClientEvent), governance doc set (COMPLIANCE, BACKUP, DATA-CLASSIFICATION, SUPPORT, DEVSECOPS, MOBILE)

## Milestones

### M2 — Web MVP screens

- Fleet, Routes (with react-leaflet map + draw), Students, Trips (live WS), Incidents, Payments, Settings — all wired
- Client-events emitter (view / print / download / copy / screenshot / visibility / idle)
- `<Sensitive>` component with copy/print/screenshot blocking for tier P1
- Impersonation banner
- **DoD**: every screen has a happy path, an empty state, a loading state, an error state, and a test

### M3 — API gap-close + governance runtime

- Missing endpoints for M2 screens
- **Governance runtime**:
  - `POST /v1/audit/events` client-events sink (rate-limited, batched, deduplicated)
  - DNC check in `CommunicationsService` before every send
  - Impersonation controller with two-eyes approval
  - Retention runner (BullMQ cron)
  - Consent + DSR controllers
- Prometheus counters (`safari_outbound_messages_total`, `safari_rfid_scans_total`, `safari_mpesa_transactions_total`, `safari_backup_last_success_age_seconds`, `safari_dnc_suppressions_total`, `safari_client_events_total`)
- Bull Board at `/admin/queues` (JWT + `tenants.manage`)
- Sentry / GlitchTip wiring end-to-end

### M4 — Documentation set + policies

- All 22 documents listed in `.copilot/SESSION-HANDOFF.md`
- Signed policy PDFs (retention, privacy notices, ToS, AUP, DPA template) — versioned + timestamped
- Data inventory (`docs/data-inventory.md`) auto-generated from Prisma `///` tags
- Post-mortem template + first BCP tabletop exercise recorded

### M5 — Tests everywhere

- Run and green the e2e suite against docker-compose Postgres + Redis
- Vitest coverage ≥ 80% on touched lines; ≥ 95% on `auth/`, `payments/`, `hardware/`
- Playwright e2e for web (login → live trip → SOS)
- Mutation testing (Stryker) weekly on the three hot modules
- Contract tests generated from OpenAPI + Zod schemas
- Enforce coverage gates in husky (pre-push)

### M6 — DX + CI/CD + branch protection + Herd

- Husky + lint-staged + commitlint
- 13 GitHub Actions workflows (see [DEVSECOPS.md](DEVSECOPS.md) §1)
- Branch protection scripted via `gh api`
- CODEOWNERS
- Herd wiring for `*.safarishule.test` with mkcert TLS
- Release-please + Conventional Commits + auto-changelog
- Cosign + syft SBOM + trivy image scan in build pipeline

### M7 — Finance & Accounting

- Chart of Accounts (IFRS-compatible) — auto-generated from a Kenya-school template
- Journal entries auto-posted on every business event (fee received, fuel paid, repair paid, payroll disbursed)
- Trial balance, P&L, balance sheet, cash flow — API + web reports
- Daily M-Pesa reconciliation job (matches Safaricom statement CSV to `MpesaTransaction`)
- Fee structures per class/route, invoice generation, statement of account per parent

### M7 — Driver Trip Workflow (✅ Complete)

Branch: `feat/m7-flutter-mobile`. See `docs/superpowers/specs/2026-09-01-driver-trip-workflow-design.md` and `docs/superpowers/plans/2026-09-02-driver-experience-consolidated-plan.md` for full design; `.superpowers/sdd/progress.md` for full task-level evidence.

- [x] DB invariant: one active trip per driver, and per vehicle (partial unique indexes + `TRIP_ALREADY_ACTIVE` 409 with `conflictType: 'driver'|'vehicle'`)
- [x] Persisted cancellation reason on trips
- [x] `GET /v1/trips/driver-workspace` / `GET /v1/trips/driver/:id` — JWT-scoped active/upcoming/recent + owned detail
- [x] Typed Flutter domain models, task-first driver dashboard with live map previews on every card
- [x] Status-aware trip detail unified across scheduled/in_progress/completed/cancelled — one shared `TripStatusShell` (map + badge + chips + bottom panel), no plain-text view remains
- [x] Driver-initiated student boarding/alighting (`POST /v1/trips/:id/board` / `/alight`, admission-number entry, parent SMS on both directions) — wired into the start-trip sheet (pre-start + mid-route) and the in-progress panel
- [x] Vehicle-level one-active-trip invariant enforced end-to-end (API + web toast + mobile SnackBar), with a real bug found and fixed along the way: mobile's active-trip-conflict parsing had never actually worked since the field was read from the wrong JSON path
- [x] Mobile branding: tenant display name flows through session → app bar → account page → redesigned centered login screen (driver role only so far — assistant/parent shells still show the raw tenant slug, a known follow-up)
- [x] Idempotent telemetry + lifecycle coordinator (login → resume → logout) for background GPS tracking
- [x] Full mobile (169/169) + API (build/typecheck/e2e) + web (85/85) verification, plus a final whole-branch review that caught and fixed 3 cross-task integration issues (frozen passenger counts after start, no mid-route boarding UI despite the API allowing it, a repeated test-hygiene risk)
- [ ] Manual Android emulator walkthrough — still recommended before considering this fully shipped
- **Known, deliberately deferred gap**: RFID-scan attendance (`AttendanceEvent` table, via `HardwareService`) and driver/assistant-manual attendance (`TripPassenger.boardedAt`/`alightedAt`, via the new board/alight endpoints) are two separate ledgers that don't cross-reference each other. Decision (2026-09-07): treat this as a known gap for now — manual entry is used to _simulate_ attendance for testing across driver and assistant roles while RFID hardware isn't available in the test environment. The two should eventually behave as **alternative input methods for the same action**, not independently-tracked processes; reconciling them (likely via a shared attendance-recording path, or making `AttendanceEvent`'s `deviceId`/`tagId` nullable so manual entries can write there too) is intentionally out of scope until after assistant workflows and comprehensive end-to-end testing.

### M7.5 — Assistant Trip Workflows (✅ Complete)

Practical goal: an assistant (e.g. a teacher riding along to help manage students) assigned to a trip can see it, send an SOS, and board/alight students — everything except starting/ending the trip itself, which stays driver-only. Reuses the driver-side work from M7 rather than duplicating it. See `docs/superpowers/plans/2026-09-07-assistant-trip-workflows.md` for the full implementation plan and completion evidence.

- [x] Board/alight ownership check generalized via shared `tripActorWhere(userId)` predicate (`src/modules/trips/trip-actor.ts`) — an assistant assigned to a trip gets the same `POST /trips/:id/board`/`/alight` access as the driver
- [x] `GET /v1/trips/assistant-workspace` and `GET /v1/trips/assistant/:id`, reusing the same underlying query logic as `driverWorkspace`/`driverDetail`
- [x] SOS endpoint (`POST /trips/:id/sos`) now validates the trip exists, is tenant-scoped, and the caller is the assigned driver or assistant — closes a real gap where any user with `incidents.report` could previously SOS an arbitrary/nonexistent trip id
- [x] Mobile: real assistant dashboard ("my assigned trip", single-trip focus) replacing the old stub; `AssistantTripScreen` composes the same map/badge/chips/board/alight/SOS UI as the driver's, without Start/End actions; assistant shell's "Trips" tab wired with prefix-based route matching (`/assistant/trip/:id` correctly highlights the Trips tab)
- [x] New API e2e coverage (`assistant-trip-workflow.e2e-spec.ts`): assistant can view/board/alight/SOS their assigned trip, 404 with no leak for unassigned trips, driver-only start/end unaffected — plus full regression pass (6 suites / 29+ tests) confirming zero impact on driver flows
- [x] Full manual e2e verification across API + web + mobile (Chrome target, no Android/iOS toolchain available in this environment): real login as seeded driver and assistant users, real trip start/board/alight/SOS, cross-checked live on the web Trips/Incidents pages
- [x] **Real bug found and fixed during manual testing**: `POST /trips/:id/driver-start` and `/driver-end` were returning a bare `Trip` row instead of the enriched `DriverTripDetail` shape the mobile client expects, causing a client-side parse failure (`FormatException: missing route`) that desynced the UI from actual server state (trip started successfully server-side, but the driver app kept showing "Scheduled"). Fixed by having both endpoints return `driverDetail()` after the status update — same enrichment logic already used by `GET /trips/driver/:id`, no duplication, no impact on web's admin start/end (which ignores the response body).
- [x] **Real bug found and fixed during manual testing**: mobile app crashed on cold start when run on a web/Chrome target — `app.dart`'s session listener called `tripTelemetryProvider.stop()` unguarded (fire-and-forget, no `.catchError`) whenever the session was null, and the native-only geolocation plugin has no web implementation. Fixed with the same `.catchError` pattern already used for push notifications two lines above.
- [x] **Forced-password navigation loop fixed (2026-09-09)**: after a forced password change, the web app now clears `mustChangePassword` in both the persisted Zustand auth store and the shared React Query `/me` cache before navigating away from `/me/security`, so `ProtectedRoute` permits subsequent navigation for every role. Covered by a SecurityPage regression test and live browser smoke verification with a disposable forced-rotation account.
- [ ] Manual Android/iOS emulator or physical-device walkthrough — still recommended; this environment had no Android SDK cmdline-tools/licenses or iOS Simulator runtime installed, so verification here used the Flutter Chrome (web) target, which exercises the same Dart code/API calls but not native platform behavior (background GPS, NFC, biometrics)

### M8 — Mobile: Remaining Parent Flows + Comprehensive Activity Logging

Deferred until after M7.5 (assistant workflows) and a comprehensive end-to-end test pass across driver + assistant + trips, per user decision 2026-09-07.

- Full details in [MOBILE.md](MOBILE.md)
- Parent shell: login by email, live trip tracking for their child(ren), board/alight visibility, admin-controlled invite flow mirroring the existing staff invite/activation pattern (see `/memories/repo/parent-portal-future-feature.md` for the full captured requirement)
- Comprehensive activity/audit logging spanning web + API + mobile + system/background/scheduled actions — who did what, when, where, and via which platform/channel, with a concrete data-integrity approach (design not yet started)
- Offline outbox (Hive) + Drift local cache
- SOS works offline (buffered, resent on reconnect)
- NFC on Android/iOS, camera QR fallback on web/desktop
- CI: signed AAB → Play Store, signed IPA → TestFlight, PWA → Cloudflare Pages
- Golden-file tests per platform

### M9 — KRA + eTIMS + Statutory returns

- eTIMS transmission for every receipt/invoice
- KRA PIN validator (with 30-day cache)
- PAYE, NHIF/SHIF, NSSF, Housing Levy calculators with versioned rates
- Monthly return exports: P10, NSSF-3, SHIF, Housing Levy — in the exact iTax CSV format
- Annual P9 PDF generation per employee
- TCC status monitor with pre-expiry alerts

### M10 — HR

- Employment contracts (versioned, PDF-signed)
- Leave management (annual/sick/compassionate/study/maternity/paternity per Employment Act 2007)
- Disciplinary case log
- Appraisal cycles (self, peer, manager, calibration)
- Payslip generation (PDF + PDF/A for archival) with all statutory deductions
- Payroll run with two-eyes approval; disbursement via M-Pesa B2C

### M11 — NTSA + NEMIS + government integrations

- `Vehicle` full compliance profile (inspection, PSV license, road service, insurance, chassis, engine, year)
- Driver license + PSV badge tracking with pre-expiry alerts
- NEMIS UPI capture + annual return CSV
- Fleet dashboard = one screen for the whole compliance posture
- County government levies + parking permits tracked in accounts

### M12 — Observability, DR, SOC-2 posture

- Grafana dashboards: API, comms (per provider), payments (per provider), backups, security events, DPA metrics
- OpsGenie / PagerDuty integration
- SOC-2 CC1–CC9 control matrix, evidence collectors
- SLSA level 3 provenance
- Bug bounty program (private) launch

### M13 — Backup + DR runtime

- All BullMQ workers per [BACKUP.md](BACKUP.md)
- `RetentionReaperWorker` running per policy
- Monthly restore drill automated
- Cross-region failover exercised quarterly
- Backup dashboards in Grafana

### M14 — Public launch

- Marketing site
- Onboarding flow for new tenants (self-service with credit card fallback)
- Public status page
- First 25 tenants live
- SOC 2 Type I certification

### M15 — Regional expansion

- Uganda + Tanzania + Rwanda variants (statutory rates, local mobile money providers — Airtel Money, MTN MoMo)
- Multi-currency
- French UI (Rwanda)
- Local data residency options where required

## Anti-goals

We are deliberately **not** doing:

- Native per-platform mobile apps (Flutter single codebase — see [MOBILE.md](MOBILE.md))
- Custom auth server (Passport JWT is fine — SSO added when needed)
- Per-tenant infrastructure — one shared DB with RLS is the model. Per-tenant DB is 10× the cost for no measurable security gain.
- Building our own maps stack (OSM / Mapbox via `flutter_map` / `react-leaflet`)
- Real-time video streams from vehicles (out of scope; SafariShule is data + comms, not surveillance)
- Building our own accounting engine core (we use a light IFRS chart + journal engine; complex firms use Xero / QuickBooks and we export)

## Decision log

| Date       | Decision                                                            | Owner |
| ---------- | ------------------------------------------------------------------- | ----- |
| 2026-06-30 | GitLab Flow + Conventional Commits + squash-into-main               | Team  |
| 2026-06-30 | All stateful services in Docker always                              | Team  |
| 2026-06-30 | Herd for local TLS on `*.safarishule.test`                          | Team  |
| 2026-07-09 | Vite + React + Tailwind + Savanna design system for web             | Team  |
| 2026-07-09 | 250+ permission atomic catalog with specialist roles                | Team  |
| 2026-07-09 | Provider abstractions for SMS + email; M-Pesa remains sole payments | Team  |
| 2026-07-09 | Full governance foundation before more product work                 | Team  |
| 2026-07-09 | Flutter single codebase for all six targets                         | Team  |

## Cadence

- **Milestone review** every Friday.
- **Roadmap re-plan** monthly.
- **Public roadmap** on the marketing site (from M14) with 6-month lookahead.
