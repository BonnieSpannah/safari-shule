# Troubleshooting — Safari Shule

Common failures and how to unstick them.

## Install / dependency

| Symptom | Fix |
|---|---|
| `pnpm install` fails building `argon2` | macOS: `xcode-select --install`. Linux: `apt install build-essential python3`. |
| "Cannot find module `@safari-shule/shared-types`" | Run `pnpm install` at the repo root — workspace symlinks are hoisted from there. |
| Prisma "engine not found" | `pnpm --filter @safari-shule/api exec prisma generate`. |
| Node version mismatch on tools | `nvm use` (reads `.nvmrc` → v20.11.0). |

## Docker

| Symptom | Fix |
|---|---|
| `make up` fails: port 5432 already in use | Another Postgres is running. `lsof -i :5432`, stop it, or change `POSTGRES_PORT` in `.env`. |
| Same for Redis 6379 / API 3000 / Web 5173 | Same pattern — bind to a free port via env. |
| `safari-postgres` restarts constantly | `docker logs safari-postgres` — usually a bad `POSTGRES_PASSWORD` or corrupted volume; `docker volume rm safari-shule_postgres_data` (⚠ destroys data). |
| `safari-api` says "connect ECONNREFUSED redis:6379" | Redis not healthy yet. `make ps`; give it 10s; if persistent, `docker restart safari-redis`. |

## Postgres / Prisma

| Symptom | Fix |
|---|---|
| "database schema is not in sync" | `make migrate` (deploy), or in dev `pnpm --filter @safari-shule/api exec prisma migrate dev`. |
| Migration hangs | Long-held lock — `SELECT * FROM pg_stat_activity` and kill blockers. |
| PostGIS function `ST_MakePoint` missing | Container didn't run `init.sql`. Check `infra/postgres/init.sql` mount; `docker exec safari-postgres psql -U safari -d safari_shule -c "CREATE EXTENSION IF NOT EXISTS postgis"`. |
| "prepared statement s0 already exists" | PgBouncer transaction mode + prepared statements — Prisma URL must include `pgbouncer=true` (already set in `.env.example`). |

## Auth

| Symptom | Fix |
|---|---|
| Login returns 500 at startup | `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` shorter than 32 chars. Regenerate. |
| Login returns 401 with correct password | User is `invited` (not `active`) — accept the invitation, or `UPDATE "User" SET status='active' WHERE …`. |
| 401 immediately after login | Cookie not being set. Check CORS (`APP_BASE_DOMAIN`) and that browser is same-site. |
| Refresh loop | Access token expired + refresh token also expired. Log in again. Persistent = clock skew — check host time (`date`). |

## Hardware HMAC

| Symptom | Fix |
|---|---|
| Every request 401 "invalid signature" | Confirm the request body is signed **before** JSON.stringify normalization (client and server must serialize identically). |
| 401 "timestamp out of window" | Client clock drift > 5m. `sntp -sS time.apple.com` on macOS. |
| 401 "device not found" | `X-Device-Id` doesn't match a `RfidDevice` row; verify with `SELECT id, status FROM "RfidDevice"`. |
| Signature is right locally but wrong via nginx | Body mutation by proxy — ensure nginx `proxy_request_buffering off;` or `proxy_pass_request_body on;` for `/v1/hardware/*`. |

## Realtime (WebSocket)

| Symptom | Fix |
|---|---|
| WS connection immediately closed | JWT missing/invalid in `Authorization` extraheader. |
| Client connects but no messages | Not joined to the right room — the client must `emit('subscribe', { tripId })` after connect. |
| Messages delayed by 1–2s | Redis pub/sub healthy? `redis-cli monitor` should show `publish` calls. |

## Payments (M-Pesa mock)

| Symptom | Fix |
|---|---|
| Transaction stays `initiated` forever | Callback loopback disabled in mock mode. Confirm `INTEGRATIONS_MODE=mock` and the internal mock scheduler is running (check API logs for `mpesa.mock.callback scheduled`). |
| Callback signature rejected in live mode | Safaricom's callback IP not in allowlist — see [SECURITY.md](SECURITY.md). |

## SMS (Africa's Talking mock)

| Symptom | Fix |
|---|---|
| No SMS visible | In mock mode SMS is logged as `outbound.sms` in API stdout. `docker logs safari-api | grep outbound.sms`. |
| DLR callback 404 | Route missing — DLR endpoint is `POST /v1/integrations/at/dlr` (Public). |

## Web (apps/web)

| Symptom | Fix |
|---|---|
| Blank page after login | Check devtools Network — the `/v1/auth/me` call. If 401, cookie flow broken (see Auth above). |
| Map tiles missing | `VITE_MAP_TILE_URL` unset or ad-blocker. Confirm in `.env` and browser console. |
| CORS error | API `APP_BASE_DOMAIN` doesn't include the web origin. |
| Vitest can't find `@/…` | `tsconfig.json` `paths` and `vite.config.ts` `resolve.alias` must agree. |

## Observability

| Symptom | Fix |
|---|---|
| Grafana shows no data | Datasource points at `http://prometheus:9090` (inside the compose network); confirm at http://localhost:3001/datasources. |
| Prometheus target down | `make logs prometheus` — usually the API's `/metrics` route not registered; check `PrometheusModule` in `AppModule`. |

## When all else fails

```bash
make reset      # ⚠ DESTRUCTIVE — drops the DB and re-seeds
```

Or nuclear:

```bash
make down
docker system prune -a --volumes    # ⚠ destroys ALL Docker state on the machine
make up && make migrate && make seed
```

Then paste the last 80 lines of `make logs` into a GitHub issue with the `bug` label.
