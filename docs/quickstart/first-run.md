# First run

Assumes you've completed [install-mac.md](install-mac.md).

## 1. Start infrastructure

```bash
make infra
```

Starts Postgres 16 + PostGIS, pgBouncer, Redis 7, and Mailhog in Docker. The API and web app run natively — no image rebuild on code changes.

Wait ~10 s, then verify everything is healthy:

```bash
make ps
```

You should see `safari-postgres` and `safari-redis` as **healthy**.

## 2. Apply the schema

```bash
make db-migrate
```

Runs all Prisma migrations. Creates every table, index, and Postgres RLS policy. Safe to run on an empty database or on top of a previous migration state.

## 3. Seed core data

```bash
make db-seed-local
```

Creates the `platform` tenant and a single super-admin user. Output:

```
[seed]  Core seed complete.
[seed]
[seed]  Super admin credentials:
[seed]    URL      : http://localhost:5173
[seed]    Email    : admin@safarishule.test
[seed]    Password : ChangeMe!Now1
[seed]    Tenant   : platform
```

The seed is **idempotent** — safe to run multiple times. If the platform tenant already exists it prints your existing credentials and exits.

## 4. Start the dev servers

```bash
# Terminal A
make api-dev    # NestJS in watch mode — reloads in ~2s on save

# Terminal B
make web-dev    # Vite HMR — reloads in <1s on save
```

Wait for both ready signals:

```
[Nest] LOG  Safari Shule API listening on :3000
VITE v5  ready  Local: http://localhost:5173/
```

## 5. Log in

Open <http://localhost:5173> in your browser.

Sign in with the credentials printed by step 3.

## 6. Create your first school

The seed creates only the super-admin account — no schools yet. From the web UI:

1. **Platform → Tenants → New tenant**
2. Fill in school name, slug (e.g. `hillcrest`), subdomain, plan tier, and contact email.
3. Set an initial administrator email + temporary password.
4. Click **Confirm & create**.

The new school is live immediately. Log out and log in as the school admin to start configuring students, fleet, and routes.

## Useful commands

| Command              | What it does                                            |
| -------------------- | ------------------------------------------------------- |
| `make infra`         | Start only Postgres + Redis (re-run if Docker restarts) |
| `make db-migrate`    | Apply pending migrations                                |
| `make db-seed-local` | Re-seed super admin (idempotent)                        |
| `make db-studio`     | Open Prisma Studio in your browser                      |
| `make logs`          | Tail all Docker service logs                            |
| `make down`          | Stop all containers (data preserved)                    |
| `make reset`         | ⚠ Drop + re-migrate + re-seed (destructive)            |

## Troubleshooting

See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common issues (port conflicts, Prisma errors, Redis connection failures).
