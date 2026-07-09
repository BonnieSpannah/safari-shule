# Safari Shule

**Multi-tenant school transport platform for Kenya.** Live bus tracking, RFID boarding, SOS incidents, M-Pesa fee collection, and Africa's Talking SMS — one deployment, many schools.

<p align="center">
  <img src="https://img.shields.io/badge/status-active%20development-emerald" alt="status">
  <img src="https://img.shields.io/badge/node-20.11.0-brightgreen" alt="node">
  <img src="https://img.shields.io/badge/pnpm-9.x-orange" alt="pnpm">
  <img src="https://img.shields.io/badge/license-proprietary-lightgrey" alt="license">
</p>

---

## Quickstart

**Prereqs:** Docker Desktop, Node.js 20+, pnpm. On macOS, [Laravel Herd](https://herd.laravel.com) is optional but strongly recommended for `*.safari-shule.test` HTTPS.

```bash
git clone git@github.com:BonnieSpannah/safari-shule.git
cd safari-shule
make preflight    # verify your machine is ready (no changes)
make bootstrap    # animated installer — .env, secrets, Herd, docker, migrate, seed
```

That's it. The bootstrap will:

1. Detect your OS + prerequisites
2. Ask a handful of environment questions (Enter accepts sensible defaults)
3. Generate all secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`)
4. Wire Herd for `*.<your-domain>` HTTPS on macOS
5. Render nginx from a template using your chosen base domain
6. `pnpm install`, `docker compose up -d`, `prisma migrate deploy`, `pnpm db:seed`
7. Print the URLs + demo credentials

When it finishes you'll see:

- **Web console** — `https://<your-domain>` (default `https://safari-shule.test`)
- **API + Swagger** — `https://api.<your-domain>/docs`
- **Tenant subdomain** — `https://hillcrest.<your-domain>`
- **Mailhog / Grafana / Prometheus / GlitchTip / Bull Board** — links printed on success

Detailed setup, custom domain wiring, and env-var reference: **[docs/SETUP.md](docs/SETUP.md)**.

## What's inside

| App / package | Path | Stack |
|---|---|---|
| Backend API | [apps/api](apps/api) | NestJS 10 · Prisma 5 · PostgreSQL 16 + PostGIS · Redis 7 · BullMQ · Socket.IO |
| Web admin | [apps/web](apps/web) | Vite · React 18 · TS · Tailwind · TanStack Query · Zustand · react-leaflet |
| Mobile *(planned)* | [apps/mobile](apps/mobile) | Flutter · Riverpod · Dio · Hive offline outbox |
| Shared types | [packages/shared-types](packages/shared-types) | Zod schemas + inferred TS types |
| Infra | [infra](infra) | Docker Compose · nginx · Prometheus · Grafana · GlitchTip · Mailhog |

## Documentation

- 🚀 **[Setup](docs/SETUP.md)** — install, env vars, first run
- 🏛 **[Architecture](docs/ARCHITECTURE.md)** — components, tenancy, request lifecycle
- 🎨 **[Design System](docs/DESIGN-SYSTEM.md)** — Savanna tokens, primitives, patterns
- 📱 **[Mobile](docs/MOBILE.md)** — Flutter one-codebase strategy for Android / iOS / Web / macOS / Windows / Linux
- 🧪 **[Testing](docs/TESTING.md)** — TDD pyramid, coverage gates, mutation testing
- 📖 **[Runbook](docs/RUNBOOK.md)** — end-to-end demo, common operations, incident playbooks
- 🔐 **[Security](docs/SECURITY.md)** — auth, RLS, HMAC, encryption at rest
- 📜 **[Compliance](docs/COMPLIANCE.md)** — Kenya DPA 2019, KRA / eTIMS, NTSA, NEMIS, retention
- 🔎 **[Data classification](docs/DATA-CLASSIFICATION.md)** — tiers, environments, masking, safe repro
- 🛟 **[Support](docs/SUPPORT.md)** — impersonation SOP, reproduce-user-issue playbook, BCP
- 🛠 **[DevSecOps](docs/DEVSECOPS.md)** — SAST/DAST/SBOM/secrets/signing/branch protection
- 💾 **[Backup & DR](docs/BACKUP.md)** — RPO/RTO, encryption, targets, restoration
- 🗺 **[Roadmap](docs/ROADMAP.md)** — sequenced milestones to production
- 🚚 **[Contributing](docs/CONTRIBUTING.md)** — branch rules, commit format, PR checklist
- 🩹 **[Troubleshooting](docs/TROUBLESHOOTING.md)** — common failures + fixes

### Go-to-market

- 💼 **[Pitch deck](docs/pitch/PITCH-DECK.md)** — investor-ready narrative, 17 slides
- 🏫 **[Product brochure](docs/pitch/PRODUCT-BROCHURE.md)** — school-facing one-pager
- 💰 **[Pricing](docs/pitch/PRICING.md)** — modest KES tiers with add-ons and hardware
- 🏛 **[Government brief](docs/pitch/GOVERNMENT-BRIEF.md)** — MoE / NTSA / KRA / county partnership pitch

- 📋 **[Session handoff](.copilot/SESSION-HANDOFF.md)** — what's built, what's next

## Hard rules

Non-negotiable for anyone (human or AI) working on this codebase:

1. **Tenant isolation is enforced at three layers** — JWT `tid` claim, Prisma `.scoped` extension, Postgres RLS.
2. **All external integrations mocked in dev/test** — `INTEGRATIONS_MODE=mock` short-circuits Africa's Talking and M-Pesa.
3. **Production-grade code only** — no `// TODO`, no stub handlers, no example placeholders.
4. **TDD** — every feature ships with tests; coverage gates in [docs/TESTING.md](docs/TESTING.md).

Full list: [.github/copilot-instructions.md](.github/copilot-instructions.md)

## License

Proprietary. All rights reserved © Safari Shule contributors.
