# Local Development with Laravel Herd — `*.safari-shule.test`

This guide walks you through setting up **Safari Shule** with Laravel Herd's `.test` TLS domains on macOS for professional-grade local development.

## Why Herd?

- **Automatic DNS resolution** — Herd's `dnsmasq` resolves `*.test` to `127.0.0.1` automatically
- **Secure by default** — mkcert generates trusted TLS certificates locally
- **No `/etc/hosts` pollution** — no manual IP entries needed
- **Matches production TLS posture** — requests/cookies work as if running on real HTTPS

## Prerequisites

1. **Laravel Herd** — https://herd.laravel.com (standard or Pro)

   ```bash
   brew install laravel/tap/herd
   ```

2. **mkcert** — local TLS certificate generator

   ```bash
   brew install mkcert
   ```

3. **Docker** — for postgres, redis, nginx, mailhog

   ```bash
   brew install docker
   # Start Docker.app or use Orbstack
   ```

4. **Node 20.11.0 & pnpm 9.x** — development tools
   ```bash
   brew install node@20
   brew install pnpm
   ```

## Quick Start (5 minutes)

### Step 1: Run the setup script

From the repo root, run:

```bash
./bin/herd-setup.sh
```

This script automatically:

- Verifies Herd & mkcert are installed
- Creates `~/Herd/safari-shule` → `~/Projects/me/safari-shule` symlink
- Generates TLS certificates for `*.safari-shule.test`
- Updates `.env` with `safari-shule.test` domain
- Prints connection instructions

### Step 2: Start the infrastructure

In one terminal:

```bash
make infra
```

This spins up:

- **postgres** on `localhost:5432` (volume: `postgres_data`)
- **redis** on `localhost:6379`
- **mailhog** on `localhost:1025` (UI at port 8025)
- **nginx** on ports `80` & `443`

### Step 3: Start the dev servers

In separate terminals (fast hot-reload):

```bash
# Terminal 1: API (NestJS)
make api-dev

# Terminal 2: Web (Vite + React)
make web-dev
```

### Step 4: Open your browser

Navigate to:

```
https://safari-shule.test
```

You'll see:

- ✅ **Green HTTPS lock** (mkcert certificate)
- ✅ **Herd dnsmasq DNS resolution** (no `/etc/hosts` needed)
- ✅ **Web admin UI** (React)
- ✅ **Hot reload on save** (Vite HMR)

**Log in with:**

- Email: `admin@safari-shule.test`
- Password: `ChangeMe!Now1`

## Domain Routing

| Domain                         | Port | Service                 | Purpose                    |
| ------------------------------ | ---- | ----------------------- | -------------------------- |
| `safari-shule.test`            | 443  | nginx → web:5173        | Web admin UI               |
| `api.safari-shule.test`        | 443  | nginx → api:3000        | REST API + Swagger         |
| `<tenant>.safari-shule.test`   | 443  | nginx → web:5173        | Tenant subdomain (future)  |
| `mailhog.safari-shule.test`    | 443  | nginx → mailhog:8025    | Email testing UI           |
| `grafana.safari-shule.test`    | 443  | nginx → grafana:3000    | Observability (optional)   |
| `prometheus.safari-shule.test` | 443  | nginx → prometheus:9090 | Metrics scraper (optional) |

All domains resolve to `127.0.0.1` via Herd's dnsmasq. TLS is handled by nginx with mkcert certificates.

## How the TLS setup works

1. **mkcert generates self-signed certificates**

   ```
   infra/certs/safari-shule.test.crt  (public certificate)
   infra/certs/safari-shule.test.key  (private key)
   ```

2. **mkcert registers the root CA** with your system's certificate store

   - macOS Keychain automatically trusts mkcert certificates
   - No browser warnings for `*.safari-shule.test`

3. **nginx listens on port 443**

   ```nginx
   server {
       listen 443 ssl;
       ssl_certificate /workspace/infra/certs/safari-shule.test.crt;
       ssl_certificate_key /workspace/infra/certs/safari-shule.test.key;
       ...
   }
   ```

4. **Herd's reverse proxy** (if Herd Pro) or **our compose nginx** handles subdomain routing
   - `safari-shule.test` → proxies to web:5173
   - `api.safari-shule.test` → proxies to api:3000
   - `<tenant>.*` → proxies to web:5173 with `X-Tenant-Slug` header

## Environment File

After running `./bin/herd-setup.sh`, your `.env` will be updated:

```bash
APP_BASE_DOMAIN=safari-shule.test
WEB_PUBLIC_URL=https://safari-shule.test
API_PUBLIC_URL=https://api.safari-shule.test
```

Cookies and CORS are scoped to `*.safari-shule.test`:

```typescript
// apps/api/src/common/config/app.config.ts
// Accept-Origin: *.safari-shule.test
// Set-Cookie: Domain=.safari-shule.test; ...
```

## Troubleshooting

### Issue: `mkcert: command not found`

**Solution:** Install mkcert

```bash
brew install mkcert
```

### Issue: `herd: command not found`

**Solution:** Install Herd

```bash
brew install laravel/tap/herd
herd install  # One-time setup
```

### Issue: `CERTIFICATE_VERIFY_FAILED` in curl

**Solution:** If curl/Node can't verify the mkcert certificate, check your local CA trust:

```bash
# macOS Keychain should auto-trust mkcert. Verify:
security find-certificate -a -c mkcert | head -20

# If missing, re-run mkcert setup:
mkcert -install
./bin/herd-setup.sh
```

### Issue: Port 80 or 443 already in use

**Solution:** Find and stop the conflicting service:

```bash
lsof -i :80
lsof -i :443

# Kill it:
kill -9 <PID>

# Or stop Herd's built-in PHP server:
herd stop
```

### Issue: Cookies not being set

**Solution:** Ensure cookie domain matches:

```bash
# Check .env:
APP_BASE_DOMAIN=safari-shule.test  # ✅ correct

# Check that requests are HTTPS:
curl -I https://safari-shule.test  # ✅ uses TLS
curl -I http://safari-shule.test   # ❌ downgrades to plain HTTP
```

### Issue: DNS not resolving

**Solution:** Check Herd's dnsmasq is running:

```bash
herd start
dig safari-shule.test  # Should return 127.0.0.1
nslookup safari-shule.test
```

## Cleaning up

To remove Herd setup without deleting your repo:

```bash
# Keep the repo, remove only Herd symlink:
rm ~/Herd/safari-shule

# Optionally, remove TLS certificates (recreate with ./bin/herd-setup.sh):
rm -rf infra/certs/
```

## Next Steps

1. ✅ Run `./bin/herd-setup.sh` to auto-configure everything
2. ✅ Run `make infra` to start Docker services
3. ✅ Run `make api-dev` and `make web-dev` in separate terminals
4. ✅ Open `https://safari-shule.test` and log in
5. 📖 Read [docs/CONTRIBUTING.md](../CONTRIBUTING.md) for commit conventions
6. 📖 Read [docs/TESTING.md](../TESTING.md) for how to run tests

## References

- [Laravel Herd docs](https://herd.laravel.com/docs)
- [mkcert — local HTTPS certificates](https://github.com/FiloSottile/mkcert)
- [Safari Shule SETUP.md](../SETUP.md) — full local installation
