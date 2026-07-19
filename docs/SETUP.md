# Setup — Safari Shule

Everything a fresh engineer needs to run the platform locally.

## Fresh install — what you get

After running the steps below, your local install has **exactly**:

- Every permission in the catalog (~250, [full list here](../packages/shared-types/src/permissions.ts))
- Every system role (`system_admin`, `school_manager`, `driver`, `assistant`, `parent`, `caretaker`) plus extended roles (`transport_admin`, `finance_admin`, `hr_admin`, `compliance_officer`, `dispatcher`) with their default permission bundles
- **One super admin user** in the technical `platform` tenant

That's it. No schools, no demo students, no vehicles. From the web UI as super admin you'll create your first school (tenant), invite its admin, and so on. Every action is auditable and role-scoped.

## Fresh install — step by step

### 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Homebrew (macOS) | latest | https://brew.sh |
| Git | 2.40+ | `brew install git` |
| Node.js | **20.11.0** | `brew install nvm && nvm install` (auto-picks `.nvmrc`) |
| pnpm | 9.x | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker Desktop | 4.30+ | https://docker.com/products/docker-desktop |

Verify:

```bash
node --version && pnpm --version && docker --version
```

### 2. Clone and install

```bash
git clone git@github.com:BonnieSpannah/safari-shule.git
cd safari-shule
pnpm install
```

### 3. Configure your environment

```bash
cp .env.example .env
```

Open `.env` in your editor. **Change these if you want non-defaults; otherwise, defaults work out of the box for local:**

| Key | Default | Purpose |
|---|---|---|
| `APP_BASE_DOMAIN` | `safarishule.test` | Base domain. Drives default super-admin email + tenant subdomain routing. |
| `WEB_PUBLIC_URL` | `http://localhost:5173` | Where users open the app. |
| `API_PUBLIC_URL` | `http://localhost:3000` | Where the API listens. |
| `SUPER_ADMIN_FULL_NAME` | `Safari Shule Super Admin` | Full name for your bootstrap user. |
| `SUPER_ADMIN_EMAIL` | `admin@safarishule.test` | Login email for your bootstrap user. Use anything you like. |
| `SUPER_ADMIN_PHONE` | `+254700000000` | For SMS notifications. |
| `SUPER_ADMIN_PASSWORD` | `ChangeMe!Now1` | **Change this before seeding**, or after first login via Profile → Security. |

Full env-var reference (Postgres, Redis, JWT, provider secrets, observability, hardware, mail, SMS, M-Pesa) is documented **in [.env.example](../.env.example) itself**, with comments explaining every value.

#### How the four env files fit together

Safari Shule uses four env files, split by security scope:

| File | Committed? | Read by | Contains |
|---|---|---|---|
| `.env.example` (root) | ✅ | (template only) | Every server-side variable, with defaults and comments. |
| `.env` (root) | ❌ gitignored | NestJS API · Prisma · docker-compose · seed | Your **server secrets** (Postgres password, JWT secrets, provider keys, super admin bootstrap). Never reaches the browser. |
| `apps/web/.env.example` | ✅ | (template only) | Every `VITE_*` browser-bundle variable. |
| `apps/web/.env.local` | ❌ gitignored | Vite (build) | Your **browser-bundle overrides** — API URL, tenant hint, map tiles. Only `VITE_*` prefixed vars are exposed to the browser. |

**Why two `.env` files?** Vite's rule: only variables prefixed `VITE_` land in the JS bundle downloaded by end users. Everything else stays server-side. This is how we guarantee secrets like `MPESA_CONSUMER_SECRET` or `JWT_ACCESS_SECRET` never leak into browser code.

**Do I need `.env.local` for the web?** Only if you want to override defaults. If Vite finds no `apps/web/.env.local`, it uses the fallbacks in `apps/web/src/lib/env.ts` — which read from `VITE_*` env vars if set, otherwise use sensible defaults. Copy `apps/web/.env.example` to `apps/web/.env.local` if you want per-machine overrides.

### 4. Bring up stateful services

Only Postgres + Redis + Mailhog. The API and web run on your host in dev mode (much faster HMR than Docker).

```bash
docker compose -f infra/docker-compose.yml --env-file .env up -d postgres redis mailhog
```

Wait ~10s for Postgres to be healthy, then verify:

```bash
docker compose -f infra/docker-compose.yml --env-file .env ps
```

You should see `safari-postgres` and `safari-redis` as **healthy**, `safari-mailhog` as **running**.

### 5. Load .env into your shell

Prisma reads `DATABASE_URL` from the shell environment. Load it once:

```bash
set -a && source .env && set +a
```

Do this in every new terminal where you'll run `prisma` or `pnpm db:seed`.

### 6. Apply the schema

```bash
pnpm --filter @safari-shule/api exec prisma migrate deploy
```

Creates every table + Postgres RLS policies.

### 7. Seed core data (roles + permissions + super admin)

```bash
pnpm --filter @safari-shule/api run db:seed
```

You'll see:

```
[seed] Creating platform tenant + super admin...
[seed]  → all permissions upserted
[seed]  → 11 system roles seeded
[seed]  → 1 super admin user assigned system_admin role
[seed] =========================================================
[seed]  Core seed complete.
[seed]  Super admin credentials:
[seed]    URL      : http://localhost:5173
[seed]    Email    : admin@safarishule.test
[seed]    Password : ChangeMe!Now1
[seed]    Tenant   : platform  (sent as X-Tenant-Slug header)
[seed] =========================================================
```

### 8. Start api + web

```bash
pnpm dev
```

Two processes run in parallel: NestJS API on `:3000`, Vite web on `:5173`.

Wait for:

```
apps/api dev: [Nest] ... LOG Safari Shule API listening on :3000
apps/web dev: VITE v5.4.8  ready ... Local: http://localhost:5173/
```

### 9. Log in

Open **http://localhost:5173** in your browser. Log in with the super admin credentials from step 7's output.

**First things a super admin does:**

1. Change password → Profile → Security
2. Create a school → Platform → Tenants → New tenant
3. Invite the school's admin → Settings → Users → Invite

## Where things live

| URL | What |
|---|---|
| http://localhost:5173 | Web console |
| http://localhost:3000 | API |
| http://localhost:3000/docs | Swagger — every endpoint documented |
| http://localhost:8025 | Mailhog — inbox for every outbound email |

## Common commands

```bash
# Full reset — wipe DB, re-migrate, re-seed
pnpm --filter @safari-shule/api exec prisma migrate reset --force --skip-seed
pnpm --filter @safari-shule/api run db:seed

# API in isolation
pnpm --filter @safari-shule/api run dev

# Web in isolation
pnpm --filter @safari-shule/web run dev

# Test
pnpm --filter @safari-shule/api run test
pnpm --filter @safari-shule/web run test

# Peek at DB
docker compose -f infra/docker-compose.yml --env-file .env exec postgres psql -U safari -d safari_shule
```

## Pretty domain (`https://safarishule.test`) — optional

If you want to use `https://safarishule.test` instead of `http://localhost:5173`:

- **On macOS with Laravel Herd**: Herd's dnsmasq already resolves `*.test` to 127.0.0.1. You still need something on port 80 to proxy → web:5173. Herd standard only serves PHP, so either upgrade to Herd Pro (has proxy) or run our docker nginx and disable Herd on port 80.
- **Any OS**: add `127.0.0.1 safarishule.test api.safarishule.test` to `/etc/hosts`, then run the docker nginx (`docker compose up -d nginx`) which proxies port 80 to web/api by hostname.

Either way, `http://localhost:5173` works today without any of that setup. The pretty domain is a nice-to-have; not required to demo, develop, or ship.

