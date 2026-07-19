# Security — Safari Shule

Threat model summary and hard rules. Full compliance mapping in `docs/compliance/` *(M4)*.

## Authentication

- **Passwords** — argon2id via `hashPassword` / `verifyPassword`. Params tuned for ~250ms on modest hardware.
- **Access token** — JWT HS256, 15-minute TTL. Payload: `{ sub, tid, email, roles[], permissions[], iat, exp }`.
- **Refresh token** — JWT HS256, 7-day TTL, includes `jti`. Set as `Set-Cookie: refresh_token=…; HttpOnly; Secure; SameSite=Lax; Path=/v1/auth`.
- **Reuse detection** — if a rotated `jti` is presented again, the entire token family is revoked (all sessions killed). User must re-authenticate.
- **Password reset** — signed one-time token, 30-minute TTL, single-use, invalidated on password change.

## Authorization

- **RBAC** — permissions are strings (`vehicles.create`, `trips.dispatch`, `tenants.manage`). Declared via `@Permissions(...)` decorator, enforced by `PermissionGuard`, cached 60s in Redis keyed by `user:${id}:permissions`.
- **Feature flags** — plan-tier gated via `@Feature(...)` decorator + `FeatureGuard`. Quotas metered per calendar month (`sms.outbound`, `mpesa.transactions`).
- **Super-admin** — `tenants.manage` permission. Cross-tenant reads/writes go through `runWithBypass()` and are audited.

## Multi-tenancy — three layers

1. **JWT `tid` claim** is authoritative. An `x-tenant-id` header alone cannot escape.
2. **Prisma `.scoped` extension** appends `where.tenantId` to every read. `.create()` must pass `tenantId: requireTenantId()` explicitly.
3. **Postgres RLS** — long transactions wrap `withTenantSession()` which issues `SET LOCAL app.tenant_id = ...`. Policies on every tenant-owned table use that GUC.

## Hardware ingestion

Requests to `/v1/hardware/*` (except device provisioning) MUST include:

| Header | Value |
|---|---|
| `X-Device-Id` | Device UUID |
| `X-Api-Key` | Public key issued at registration |
| `X-Timestamp` | Current time in **milliseconds** |
| `X-Signature` | `hex(HMAC-SHA256(hmacSecret, "${deviceId}.${timestamp}.${rawBody}"))` |

- **Replay window** — ±5 minutes (configurable via `HARDWARE_HMAC_REPLAY_WINDOW_SECONDS`).
- **Timestamp comparison** — server clock; NTP-synced containers required.
- **Rate limit** — `HARDWARE_THROTTLE_PER_MINUTE` per `deviceId` (default 60).
- **Secret storage** — `RfidDevice.hmacSecret` is AES-256-GCM encrypted at rest with `DATA_ENCRYPTION_KEY`. Never logged, never returned in list responses.
- **Rotation** — `POST /v1/hardware/devices/:id/rotate` returns new secret **once**. Old secret works during a 24h grace window (`status = 'rotating'`), then invalidated.

## Encryption at rest

- **Column-level** — `RfidDevice.hmacSecret`, `OtpCode.hashedCode` (bcrypt), `RefreshToken.hashedToken` (SHA-256).
- **Key material** — `DATA_ENCRYPTION_KEY` env var (32 bytes hex). Rotated by generating a new key, decrypting-and-re-encrypting the affected columns in a background job, then swapping the key.

## Transport

- **TLS everywhere** — dev via Herd + mkcert; prod via managed certificates.
- **CORS** — strict allowlist derived from `APP_BASE_DOMAIN`. Credentials required on the auth cookie.
- **Cookies** — `HttpOnly`, `Secure`, `SameSite=Lax`. Never `SameSite=None` without CSRF token.
- **CSRF** — refresh endpoint uses cookie + `Origin` header check; no double-submit token needed because refresh is not user-initiated from arbitrary origins.

## Rate limiting

- **Global** — `ThrottlerGuard` at 100 rps per IP.
- **Auth routes** — 10 rpm per IP.
- **Hardware routes** — `HARDWARE_THROTTLE_PER_MINUTE` per device.
- **M-Pesa callback** — IP allowlist (Safaricom subnets) + signature verification.

## Secrets

- Never in source. All configuration in `.env` (local) or GitHub Environments (CI + prod).
- Secret scanning — `gitleaks` in CI blocks pushes containing secret-shaped strings.
- Rotation cadence: JWT secrets quarterly, `DATA_ENCRYPTION_KEY` annually, third-party API keys per provider rotation.

## Audit

- Every write is audited to `audit_log` with `traceId`, `tenantId`, `userId`, method, path, status, latency, and `bypass` flag.
- Retention: 12 months hot, 5 years cold (compliance).
- Read access to `audit_log` requires the `audit.read` permission (super-admin only).

## OWASP Top 10 posture

| Risk | Mitigation |
|---|---|
| A01 Broken Access Control | RBAC + FeatureGuard + RLS + `.scoped` + audit log |
| A02 Cryptographic Failures | argon2id, AES-256-GCM, TLS 1.2+ only |
| A03 Injection | Prisma parameterization; raw SQL only for PostGIS (parameterized) |
| A04 Insecure Design | Threat model reviewed per feature; STRIDE for auth changes |
| A05 Security Misconfiguration | Compose configs pinned; env vars validated via `@nestjs/config` schema at boot |
| A06 Vulnerable Components | Dependabot + trivy scan in CI |
| A07 Identification/Auth Failures | Reuse-detected refresh, argon2id, rate-limited auth |
| A08 Software/Data Integrity | Cosign signing + syft SBOM per image; branch protection with required checks |
| A09 Security Logging Failures | Pino + audit log + Sentry/GlitchTip; alerts on 5xx spikes |
| A10 SSRF | Outbound HTTP allowlisted (Africa's Talking, Safaricom Daraja); no user-supplied URLs fetched |

## Reporting a vulnerability

Email `security@safarishule.co.ke` (private). Do NOT open a public GitHub issue. Response SLA: 48h ack, 14d fix or mitigation plan.
