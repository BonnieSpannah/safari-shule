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
- Herd wiring for `*.safari-shule.test` with mkcert TLS
- Release-please + Conventional Commits + auto-changelog
- Cosign + syft SBOM + trivy image scan in build pipeline

### M7 — Finance & Accounting

- Chart of Accounts (IFRS-compatible) — auto-generated from a Kenya-school template
- Journal entries auto-posted on every business event (fee received, fuel paid, repair paid, payroll disbursed)
- Trial balance, P&L, balance sheet, cash flow — API + web reports
- Daily M-Pesa reconciliation job (matches Safaricom statement CSV to `MpesaTransaction`)
- Fee structures per class/route, invoice generation, statement of account per parent

### M8 — Mobile (Flutter, one codebase, six targets)

- Full details in [MOBILE.md](MOBILE.md)
- Driver + Assistant + Parent shells in the same binary
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

| Date | Decision | Owner |
|---|---|---|
| 2026-06-30 | GitLab Flow + Conventional Commits + squash-into-main | Team |
| 2026-06-30 | All stateful services in Docker always | Team |
| 2026-06-30 | Herd for local TLS on `*.safari-shule.test` | Team |
| 2026-07-09 | Vite + React + Tailwind + Savanna design system for web | Team |
| 2026-07-09 | 250+ permission atomic catalog with specialist roles | Team |
| 2026-07-09 | Provider abstractions for SMS + email; M-Pesa remains sole payments | Team |
| 2026-07-09 | Full governance foundation before more product work | Team |
| 2026-07-09 | Flutter single codebase for all six targets | Team |

## Cadence

- **Milestone review** every Friday.
- **Roadmap re-plan** monthly.
- **Public roadmap** on the marketing site (from M14) with 6-month lookahead.
