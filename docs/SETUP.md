# Setup — Safari Shule

Everything a fresh engineer needs to run the platform locally.

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| macOS / Linux | any recent | — |
| Homebrew (macOS) | latest | https://brew.sh |
| Git | 2.40+ | `brew install git` |
| Node.js | **20.11.0** | `brew install nvm && nvm install` (auto-picks `.nvmrc`) |
| pnpm | 9.x | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker Desktop | 4.30+ | https://docker.com/products/docker-desktop |
| GitHub CLI | 2.55+ | `brew install gh` |
| Laravel Herd *(optional)* | latest | https://herd.laravel.com — for `*.safari-shule.test` domains + TLS |

Verify:

```bash
node --version    # v20.11.0
pnpm --version    # 9.x
docker --version  # 4.30+
docker compose version
```

## 2. Clone and install

```bash
git clone git@github.com:BonnieSpannah/safari-shule.git
cd safari-shule
nvm use          # switches to 20.11.0
corepack enable
pnpm install
```

## 3. Environment

```bash
cp .env.example .env
```

At minimum, set these three keys in `.env` before first boot:

```bash
JWT_ACCESS_SECRET=<32+ random chars>
JWT_REFRESH_SECRET=<32+ random chars, different from access>
DATA_ENCRYPTION_KEY=<64 hex chars = 32 bytes for AES-256-GCM>
```

Generate them quickly:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"        # DATA_ENCRYPTION_KEY
```

Leave `INTEGRATIONS_MODE=mock` for local — it short-circuits Africa's Talking and M-Pesa. Never commit `.env`.

Full variable reference: [Environment variables](#environment-variables) below.

## 4. Bring up stateful services

```bash
make up          # postgres · pgbouncer · redis · mailhog · prometheus · grafana · glitchtip · api · web · nginx
make ps          # confirm every service is (healthy) or (running)
```

First boot pulls images (~2–5 min). After that:

```bash
make migrate     # apply Prisma migrations
make seed        # create Hillcrest demo tenant + users + RFID device
```

The seed prints demo credentials and a **one-time** RFID device `apiKey` + `hmacSecret` — copy them for hardware demos.

## 5. Run the apps in dev mode

You have two options.

### Option A — everything in Docker (matches CI)

```bash
make up          # already includes api + web
open http://localhost:3000/docs   # API Swagger
open http://localhost:5173        # Web admin
```

### Option B — host-mode dev (fast HMR, recommended for daily work)

Keep only stateful services in compose; run api + web on the host.

```bash
# in one terminal — stateful services only
docker compose -f infra/docker-compose.yml up -d postgres pgbouncer redis mailhog prometheus grafana

# in another terminal — everything
pnpm dev         # runs @safari-shule/api and @safari-shule/web in parallel
```

## 6. Demo credentials

After `make seed`:

| Role | Email | Password |
|---|---|---|
| System admin | `admin@hillcrest.ac.ke` | `Demo!Password1` |
| Driver A / B, Assistant, Parent, Caretaker | see seed output | `Demo!Password1` |

Tenant slug `hillcrest` · Subdomain `hillcrest.safari-shule.test`.

## 7. Local domains with Laravel Herd (optional but recommended)

```bash
ln -s ~/Projects/me/safari-shule ~/Herd/safari-shule
herd secure safari-shule
```

Then `*.safari-shule.test` resolves over HTTPS. Map:

| Host | Points to |
|---|---|
| `safari-shule.test` | Web admin |
| `api.safari-shule.test` | Nest API |
| `hillcrest.safari-shule.test` | Tenant subdomain |
| `mailhog.safari-shule.test` | Mailhog UI (8025) |
| `grafana.safari-shule.test` | Grafana (3001) |
| `prometheus.safari-shule.test` | Prometheus (9090) |
| `glitchtip.safari-shule.test` | GlitchTip (8001) |

## 8. Common commands

```bash
make up                                              # start the stack
make down                                            # stop (preserves volumes)
make logs                                            # tail all services
make reset                                           # ⚠ DESTRUCTIVE — drop DB + reseed
make db-shell                                        # psql into postgres
make redis-shell                                     # redis-cli

pnpm dev                                             # api + web parallel
pnpm --filter @safari-shule/api run build            # nest build
pnpm --filter @safari-shule/api run test             # api unit + integration
pnpm --filter @safari-shule/api run test:e2e         # api e2e
pnpm --filter @safari-shule/web run dev              # vite dev server
pnpm --filter @safari-shule/web run test             # vitest
pnpm --filter @safari-shule/web run build            # production bundle
pnpm --filter @safari-shule/api exec prisma studio   # DB browser at :5555
```

## Environment variables

Full template: [.env.example](../.env.example). Grouped essentials:

| Group | Keys | Purpose |
|---|---|---|
| Runtime | `NODE_ENV`, `API_PORT`, `WEB_PORT`, `APP_BASE_DOMAIN`, `INTEGRATIONS_MODE` | Runtime toggles |
| Postgres | `POSTGRES_USER/PASSWORD/DB/HOST/PORT`, `DIRECT_URL`, `DATABASE_URL` | `DIRECT_URL` for migrate, `DATABASE_URL` via PgBouncer |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL` | Cache / queue / GEO / pub-sub |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | JWT signing |
| Africa's Talking | `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`, `AT_DLR_CALLBACK_URL` | SMS (mock in dev) |
| M-Pesa Daraja | `MPESA_ENV`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` | Payments (mock in dev) |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email → Mailhog locally |
| Observability | `SENTRY_DSN_API`, `SENTRY_DSN_WEB`, `SENTRY_ENVIRONMENT`, `LOG_LEVEL` | Blank DSN = disabled |
| Hardware | `HARDWARE_HMAC_REPLAY_WINDOW_SECONDS`, `HARDWARE_THROTTLE_PER_MINUTE` | RFID/GPS ingest |
| Crypto | `DATA_ENCRYPTION_KEY` | AES-256-GCM for device secrets (32 bytes hex) |

## Next

- Take the guided tour: [RUNBOOK.md](RUNBOOK.md)
- Read the shape of the code: [ARCHITECTURE.md](ARCHITECTURE.md)
- Contribute: [CONTRIBUTING.md](CONTRIBUTING.md)
