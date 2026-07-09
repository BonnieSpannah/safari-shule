# Runbook — Safari Shule

Step-by-step recipes for running, demoing, operating, and troubleshooting the platform.

## Contents

1. [End-to-end demo (fresh install → live SOS)](#1-end-to-end-demo)
2. [Daily development loop](#2-daily-development-loop)
3. [Applying a schema change](#3-applying-a-schema-change)
4. [Rotating a hardware device secret](#4-rotating-a-hardware-device-secret)
5. [Onboarding a new tenant](#5-onboarding-a-new-tenant)
6. [Recovering from a broken migration](#6-recovering-from-a-broken-migration)
7. [Diagnosing "why is my request 401 / 403?"](#7-diagnosing-401--403)
8. [Reading the audit log](#8-reading-the-audit-log)
9. [Rollback a deployment](#9-rollback-a-deployment)

---

## 1. End-to-end demo

The full "showcase this to someone" flow. Assumes a fresh clone.

### Terminal layout

- **T1** — the stack (`make up` / `make logs`)
- **T2** — demo commands (curl / node)
- **T3** — peeking (psql / redis-cli)

### Act 1 — Boot

```bash
cd ~/Projects/me/safari-shule
nvm use
[[ -f .env ]] || cp .env.example .env
# ensure JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATA_ENCRYPTION_KEY are set
make up
make ps    # confirm all services healthy / running
```

### Act 2 — Migrate + seed

```bash
make migrate
make seed
# → capture printed device apiKey + hmacSecret
```

### Act 3 — Log in as admin

```bash
export API=http://localhost:3000
TOKEN=$(curl -s -X POST $API/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@hillcrest.ac.ke","password":"Demo!Password1"}' \
  | jq -r '.accessToken')
echo "Access token: ${TOKEN:0:40}..."
```

Or in the web app: open http://localhost:5173, log in with the same credentials.

### Act 4 — Tour

```bash
curl -s $API/v1/fleet/vehicles -H "Authorization: Bearer $TOKEN" | jq '.data[] | {plate, capacity, status}'
curl -s $API/v1/routes -H "Authorization: Bearer $TOKEN" | jq '.data[] | {code, name, direction}'
curl -s $API/v1/students -H "Authorization: Bearer $TOKEN" | jq '.data[] | {name, rfidTagUid}'
```

### Act 5 — Invite a new parent

```bash
curl -s -X POST $API/v1/onboarding/invitations \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"newparent@example.com","role":"parent","fullName":"New Parent"}' | jq
```

Open Mailhog: http://localhost:8025 — the invitation email is there.

### Act 6 — Simulate an RFID scan

```bash
DEVICE_ID=<from seed>
API_KEY=<from seed>
SECRET=<from seed>
TS=$(node -e 'process.stdout.write(String(Date.now()))')
BODY=$(printf '{"device_id":"%s","tag_uid":"04A1B2C3","timestamp":%s}' "$DEVICE_ID" "$TS")
SIG=$(node -e "console.log(require('crypto').createHmac('sha256','$SECRET').update('$DEVICE_ID.$TS.'+'$BODY').digest('hex'))")

curl -s -X POST $API/v1/hardware/rfid-scan \
  -H "X-Device-Id: $DEVICE_ID" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  -H 'Content-Type: application/json' \
  -d "$BODY" | jq
```

Verify in DB:

```bash
make db-shell
# in psql:
SELECT id, "tenantId", "studentId", direction, "eventTime" FROM "AttendanceEvent" ORDER BY "eventTime" DESC LIMIT 5;
```

### Act 7 — Live GPS + WebSocket

Push a GPS ping (same signing scheme as RFID):

```bash
BODY=$(printf '{"device_id":"%s","lat":-1.286389,"lng":36.817223,"timestamp":%s}' "$DEVICE_ID" "$TS")
SIG=$(node -e "console.log(require('crypto').createHmac('sha256','$SECRET').update('$DEVICE_ID.$TS.'+'$BODY').digest('hex'))")
curl -s -X POST $API/v1/hardware/gps \
  -H "X-Device-Id: $DEVICE_ID" -H "X-Api-Key: $API_KEY" \
  -H "X-Timestamp: $TS" -H "X-Signature: $SIG" \
  -H 'Content-Type: application/json' -d "$BODY" | jq
```

Verify the GEO write in Redis:

```bash
make redis-shell
# > GEOPOS "tenant:hillcrest:live" "vehicle:<vehicleId>"
```

Watch it live in the web app: open the **Trips** page, click the in-progress trip — you should see the marker move.

### Act 8 — Trigger SOS

```bash
curl -s -X POST $API/v1/incidents/sos \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"sos","severity":"high","lat":-1.286389,"lng":36.817223,"note":"Demo SOS"}' | jq
```

In `INTEGRATIONS_MODE=mock`, the SMS leg is captured in the API logs (grep for `outbound.sms`). In the web app, the top-of-screen banner turns rose and the incident appears in **Incidents**.

### Act 9 — M-Pesa STK Push (mock)

```bash
curl -s -X POST $API/v1/payments/mpesa/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"purpose":"fuel","amount":1500,"phone":"+254700000000","reference":"FUEL-001"}' | jq
```

Response includes a `transactionId`. In mock mode, the callback is auto-invoked after ~2 seconds; the transaction status transitions `initiated → succeeded`. Verify in DB:

```sql
SELECT id, purpose, amount, status, "createdAt" FROM "MpesaTransaction" ORDER BY "createdAt" DESC LIMIT 5;
```

### Act 10 — Observability tour

- Prometheus targets: http://localhost:9090/targets
- Grafana dashboard: http://localhost:3001 (`admin` / `admin`) → "API Overview"
- GlitchTip: http://localhost:8001 (no errors is a good outcome)

### Act 11 — Impossible: cross-tenant read

Attempt to read another tenant's data with the admin token. Expected: 404 (not 403 — we don't reveal existence).

```bash
# using an ID from a different tenant
curl -s -o /dev/null -w "%{http_code}\n" \
  $API/v1/fleet/vehicles/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $TOKEN"
# → 404
```

---

## 2. Daily development loop

```bash
# once per day
make up

# then in a separate terminal
pnpm dev

# make a change
# → hot reload in web
# → nest --watch reloads api
# → tests run on save (vitest --watch)
```

Before pushing:

```bash
pnpm --filter @safari-shule/api run build
pnpm --filter @safari-shule/api exec tsc --noEmit
pnpm --filter @safari-shule/web run build
pnpm --filter @safari-shule/api run test
pnpm --filter @safari-shule/web run test
```

---

## 3. Applying a schema change

```bash
# edit apps/api/prisma/schema.prisma
pnpm --filter @safari-shule/api exec prisma migrate dev --name descriptive_name
pnpm --filter @safari-shule/api exec prisma generate

# → generated migration is now in apps/api/prisma/migrations/
# → commit both schema.prisma AND the migration folder
```

Destructive changes (dropping a column, changing a type) require a paired backfill migration and the `allow-destructive` PR label.

---

## 4. Rotating a hardware device secret

```bash
TOKEN=<admin token>
DEVICE_ID=<device id>

curl -s -X POST $API/v1/hardware/devices/$DEVICE_ID/rotate \
  -H "Authorization: Bearer $TOKEN" | jq
# → response includes newApiKey + newHmacSecret (SHOWN ONCE)
# → device is now status=rotating for 24h; old secret still works
# → after 24h, status auto-transitions to active with only the new secret
```

Deliver the new secret to the vehicle over your out-of-band channel (never SMS or email).

---

## 5. Onboarding a new tenant

Super-admin path only. Requires the `tenants.manage` permission (only the seeded system admin has it in local dev; in prod, granted per-user).

```bash
curl -s -X POST $API/v1/tenant-admin/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "slug": "sunrise",
    "subdomain": "sunrise",
    "name": "Sunrise Academy",
    "contactEmail": "admin@sunrise.ac.ke",
    "planTier": "pro",
    "adminFullName": "Sunrise Admin",
    "adminEmail": "admin@sunrise.ac.ke"
  }' | jq
# → returns tenant + invitation link for the admin user
```

The admin accepts via `POST /v1/onboarding/invitations/:token/accept` with their password. From there, the tenant onboards its own users through the web app.

---

## 6. Recovering from a broken migration

```bash
# see what happened
pnpm --filter @safari-shule/api exec prisma migrate status

# if a migration is applied but the schema is drifted:
pnpm --filter @safari-shule/api exec prisma migrate resolve --applied <migration_name>

# if the migration itself is broken locally (never committed):
rm -rf apps/api/prisma/migrations/<broken>
pnpm --filter @safari-shule/api exec prisma migrate reset --force
pnpm --filter @safari-shule/api exec prisma migrate dev
```

**Never** edit an already-committed migration. Ship a new one that corrects it.

---

## 7. Diagnosing 401 / 403

Order of checks:

1. **401** = auth failed. Check the JWT header, verify signature with the same `JWT_ACCESS_SECRET` the API is using, confirm not expired.
2. **403** = auth ok, authorization failed. Look at the `x-required-permissions` response header (added by `PermissionGuard`) — that's the permission the caller lacks.
3. Check `audit_log` for the request's `traceId` — it records `userId`, `permissions[]`, and the denying guard.

```sql
SELECT "traceId", "userId", method, path, status, "denyReason"
FROM audit_log
WHERE "createdAt" > now() - interval '5 minutes'
ORDER BY "createdAt" DESC;
```

---

## 8. Reading the audit log

Every mutation is written to `audit_log`. Query patterns:

```sql
-- Recent activity by a user
SELECT * FROM audit_log WHERE "userId" = '<uuid>' ORDER BY "createdAt" DESC LIMIT 50;

-- Everything a tenant did in the last hour
SELECT method, path, status, count(*)
FROM audit_log
WHERE "tenantId" = '<uuid>' AND "createdAt" > now() - interval '1 hour'
GROUP BY method, path, status
ORDER BY count(*) DESC;

-- All cross-tenant bypasses (should be near-zero)
SELECT * FROM audit_log WHERE bypass = true ORDER BY "createdAt" DESC LIMIT 20;
```

---

## 9. Rollback a deployment

*(Available once M6 lands CI/CD workflows.)*

```bash
gh workflow run rollback.yml -f version=<previous-sha-or-tag>
```

The workflow redeploys the previous immutable digest from GHCR. Requires the `production` environment reviewer approval.
