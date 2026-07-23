# Safari Shule — Copilot Workspace Instructions

Kenyan multi-tenant school transport platform. Production-grade quality required: no `// TODO` placeholders, no stub functions, no example-only handlers.

## Stack & versions (non-negotiable)

- **Node 20.11.0** (auto-switched via `.nvmrc`)
- **pnpm 9.x** workspace monorepo (`pnpm-workspace.yaml`)
- **NestJS 10.4.4** + **TypeScript 5.5.4** strict
- **Prisma 5.20.0** + **PostgreSQL 16** + **PostGIS 3.4** (single DB, multi-tenant)
- **Redis 7** (cache, BullMQ, Socket.IO adapter, GEO)
- **Zod 3.23.8** for all DTO validation — schemas live in `packages/shared-types`

## Repo layout

```
apps/api/                 NestJS backend (only app currently built)
apps/web/                 Vite + React + Tailwind admin (planned)
apps/mobile/              Flutter app (planned)
packages/shared-types/    Zod schemas + inferred TS types shared across apps
infra/                    docker-compose stacks, prometheus, grafana
```

## Hard rules

1. **Tenant scoping is mandatory.** Every Prisma `.create()` MUST pass an explicit `tenantId: requireTenantId()`. Reads use `prisma.scoped` (auto-injects `tenantId`); bypass only via `runWithBypass()` from `src/common/context/request-context.ts` for super-admin/seeding paths.
2. **RLS at the DB layer.** Long-running transactions use `withTenantSession()` which issues `SET LOCAL app.tenant_id`.
3. **JWT pins the tenant.** The `tid` claim is authoritative; an `x-tenant-id` header alone cannot unlock another tenant.
4. **Hardware HMAC.** Devices auth with `X-Device-Id` + `X-Api-Key` + `X-Timestamp` (milliseconds) + `X-Signature` = HMAC-SHA256(`${deviceId}.${timestamp}.${rawBody}`, hmacSecret). Replay window ±5min. HMAC secrets are AES-256-GCM encrypted with `DATA_ENCRYPTION_KEY`.
5. **External integrations are mocked in test/dev.** `INTEGRATIONS_MODE=mock` short-circuits Africa's Talking and M-Pesa. Never call live endpoints from tests.
6. **No comments unless the WHY is non-obvious.** No file-header docstrings. No "added for X" comments.
7. **Auth.** Passwords are argon2id via `hashPassword`/`verifyPassword`. JWT access 15m, refresh 7d with `jti` reuse-detection.

## Development workflow (preferred: native API + Docker infra)

Run infrastructure in Docker, API and web natively — **no image rebuild needed** for code changes:

```bash
make infra               # postgres + redis + mailhog in Docker
make api-dev             # NestJS watch mode (~2s reload on save)
make web-dev             # Vite HMR (<1s reload on save)
```

Full Docker stack (CI-parity, use for validating the production image):

```bash
make up                  # build + start everything in Docker
```

## Common commands (run from repo root)

```bash
pnpm install
pnpm --filter @safari-shule/api run build          # NestJS build (must exit 0)
pnpm --filter @safari-shule/api exec tsc --noEmit  # Typecheck only
pnpm --filter @safari-shule/api exec tsc --noEmit -p test/tsconfig.test.json
pnpm --filter @safari-shule/api run test:e2e       # Jest e2e
make infra                                         # docker compose up postgres+redis (no API)
make db-migrate                                    # prisma migrate deploy (local)
make db-migrate-new NAME=add_xyz                   # prisma migrate dev --name add_xyz (interactive)
make db-generate                                   # prisma generate (after schema changes)
make db-seed-local                                 # seed hillcrest demo tenant natively
```

## Global request pipeline (apps/api)

Guards (in order): `ThrottlerGuard` → `JwtAuthGuard` → `PermissionGuard` → `FeatureGuard`.
Interceptor: `AuditInterceptor` (writes to `audit_log`).
All routes under `/v1` prefix.

## When editing Prisma

- Always run against `apps/api/prisma/schema.prisma`.
- After schema changes: `pnpm --filter @safari-shule/api exec prisma migrate dev --name <change>` then `pnpm --filter @safari-shule/api exec prisma generate`.
- Geography columns are `Unsupported("geography(Point, 4326)")` — create/update them with raw SQL using `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`.

## Demo credentials (after `make db:seed`)

- Tenant: `hillcrest`
- Admin: `admin@hillcrest.ac.ke` / `Demo!Password1`
- See seed output for driver/parent/caretaker creds + the printed RFID device `apiKey`/`hmacSecret`.

## Session handoff

If you're a fresh chat picking up work, read [.copilot/SESSION-HANDOFF.md](../.copilot/SESSION-HANDOFF.md) first — it captures what's built, what's broken, and what's next.
