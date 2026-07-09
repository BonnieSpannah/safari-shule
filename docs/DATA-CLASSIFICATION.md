# Data Classification & Environment Access Controls — Safari Shule

Not all data deserves the same protection, and not every engineer needs to see production. This doc defines the tiers, the environments, and how a support engineer reproduces a customer issue **without ever seeing raw PII**.

## 1. Data classification tiers

| Tier | Examples | Handling |
|---|---|---|
| **P0 — Critical secret** | JWT signing keys, `DATA_ENCRYPTION_KEY`, KMS master keys, root DB passwords, RFID device `hmacSecret` (plaintext), M-Pesa passkey | Only in KMS / Vault. Never in a `.env` in prod. Never printed to logs. Never in a bug report. |
| **P1 — Regulated PII (special)** | Children's identity, health flags, biometric identifiers, exact home GPS, KRA PIN | Encrypted at rest; masked in non-prod; access requires just-in-time (JIT) grant + audit trail |
| **P2 — Regulated PII (standard)** | Adult identity, phone, email, address, guardian records, staff records | Encrypted at rest; masked in non-prod for anyone without the `pii.read` permission |
| **P3 — Operational** | Trip metadata, vehicle info, route geometry, aggregate telemetry, audit logs, `client_events` | Available in dev with fake data; prod access needs `audit.view` |
| **P4 — Public** | Marketing content, tenant slug, published route names | No restrictions |

Every Prisma model is tagged in `schema.prisma` with `/// @data.tier PN` and `/// @data.category <cat>`. The tag drives:

- masking strategy in dumps
- retention default
- generated Records of Processing Activities (RoPA)

## 2. Environment matrix

| Env | Purpose | Data | Who has access | Provider defaults |
|---|---|---|---|---|
| **local** | Developer laptop | Faker-generated seed only | Developer themselves | mock SMS, Mailhog, mock M-Pesa |
| **dev** | Shared dev env | Faker seed + reset nightly | All engineers | mock SMS, Mailhog, mock M-Pesa |
| **preview-*** | Ephemeral per-PR | Faker seed | PR reviewers | mock SMS, Mailhog, mock M-Pesa |
| **uat / staging** | UAT with school admins | Weekly **masked** snapshot from prod | Engineering, QA, product, invited tenant admins | live AT sandbox, Mailtrap, M-Pesa sandbox |
| **prod** | Real tenants | Real | On-call only via JIT; DBAs; DPO | live AT prod, prod SMTP (SES / Postmark), M-Pesa production |
| **prod-restore** | Isolated restore verification | Whatever was restored — treat as prod | 2-eyes access only | offline (no outbound) |

### Ports & DNS separation

- Prod, staging, dev live in **separate AWS accounts** (or GCP projects). No cross-account read.
- No shared credentials. Break-glass credentials are Vault-only + auto-expire after 4h.

## 3. Masking policy — how staging gets prod-shaped data without prod PII

The `db:masked-dump` job (`ops/masking/dump.sh`, M2) runs weekly against a **read replica** of prod:

1. Take `pg_dump --format=custom` of the replica.
2. Restore into a scratch Postgres.
3. Apply the masking SQL pack `ops/masking/mask.sql`:
   - `User.fullName` → `Person <hash(id)>`
   - `User.email` → `user+<hash(id)>@example.test`
   - `User.phoneE164` → `+254 700 <hash7digits(id)>`
   - `Student.fullName` → `Learner <hash(id)>`
   - `Student.dateOfBirth` → keep month/year, day = 15
   - `Student.nemisUpi` → `MASKED-<hash(id)>`
   - `Parent.kraPin` → `MASKED-<hash(id)>`
   - `MpesaTransaction.phoneE164` → same masking as User phone
   - `MpesaTransaction.mpesaReceiptNumber` → `MASKED-<hash(id)>`
   - `GpsPing.location` → jittered by ±300 m
   - `AttendanceEvent` timestamps → jittered ±60 s
   - `Consent.evidencePayload`, `DsrRequest.auditPayload` — dropped entirely
   - `RfidTag.uid` → randomized (breaks physical linkage)
   - `RfidDevice.hmacSecret` → regenerated (breaks physical linkage)
   - `password_hash` → all set to `$argon2id$…` of `Uat!Password1`
4. Emit as a new `pg_dump` artifact → uploaded to the staging bucket → restored into staging weekly.

The masking function is **deterministic per (tenantId, id)** so the same student in dev today is the same synthetic student tomorrow — that's what makes bug reproduction tractable.

`ops/masking/mask.sql` is CI-checked: every table with tier P1 / P2 must have a masking rule; if any new column of category `identity` / `contact` / `financial` / `health` / `credentials` lacks a rule, the check fails.

## 4. Reproducing a customer issue — the safe path

**Never** log into a user account with their credentials. **Never** run `UPDATE User SET password_hash = …` in prod to "just try". Every one of those is a P0 incident.

Instead:

### Path A — Reproduce with masked staging (default; no prod PII exposure)

1. Get the customer's tenant slug + a description of the issue + ideally the request `traceId`.
2. `ssh` into the ops box; run:

    ```bash
    ./ops/repro/pull-trace.sh --tenant hillcrest --trace-id <uuid> --out /tmp/trace.json
    ```

   This exports the audit_log + client_events + relevant DB rows for that trace, **anonymized on export**.

3. In staging, load the masked equivalent of the customer's tenant, replay the exact request sequence:

    ```bash
    ./ops/repro/replay.sh --trace /tmp/trace.json --target https://staging.safari-shule.co.ke
    ```

4. Fix in a feature branch; write a test that codifies the bug; merge; ship.

### Path B — Support-scoped impersonation (needs approval)

For issues that only reproduce with the customer's exact data:

1. Support engineer opens an `ImpersonationSession` via the API:

    ```
    POST /v1/support/impersonation
    { targetUserId, reason, ticketRef, expiresIn: "1h", scope: ["trips.view","incidents.view"] }
    ```

2. Status = `pending_approval`. **Two-eyes** approval: a second engineer with the `support.approve` permission approves via API or the ops console.

3. On approval, the API mints a **scoped, short-lived** access token:
   - Different `iss` claim: `safari-shule/support`
   - `impersonating: true` claim → every request shows a persistent red banner in the web app
   - Permissions **intersected** with the requested scope (never a full superset)
   - TTL 1 hour max; single active impersonation per support user
   - Cannot mint new impersonations (no delegation)

4. Every action while impersonating is logged with `client_events.kind = impersonation_*` **plus** the underlying business `audit_log` row.

5. Auto-end when: TTL expires, support signs out, target user logs in (immediate revoke), or scope is exceeded.

6. Post-session, the impersonation record is emailed to the tenant admin as a transparency notice (opt-out for signed-support-agreement customers only).

### What impersonation **cannot** do

- Change the target user's password
- Read `credentials` category data (password hashes, refresh tokens, HMAC secrets in plaintext)
- Initiate a payment on the user's behalf (blocked at controller with `impersonating` check)
- Approve their own escalation
- Access another tenant

### Never do (support hall-of-shame)

- ❌ "Let me just reset their password real quick" — use the tenant admin's password reset flow.
- ❌ Copy-pasting a JWT from a customer's browser to yours.
- ❌ Enabling a customer feature flag globally to test "just for a minute".
- ❌ Running a `SELECT * FROM users` in prod. Use the ops read replica with column-level GRANTs.

## 5. Prod access — JIT / break-glass

Direct DB access to prod is off by default.

1. Engineer needs prod access → creates a JIRA ticket with reason + duration.
2. Approver (on-call lead) reviews → runs `./ops/access/grant.sh --user <name> --duration 2h --scope readonly`.
3. Grant provisions:
   - Time-boxed IAM role in AWS
   - A PostgreSQL role with `pg_read_all_data` + no write grants
   - A Kubernetes RBAC binding for `kubectl logs` only
4. On expiry, the role is auto-revoked. Extension requires a new ticket.
5. Every command run under the grant is captured (Teleport session recording or equivalent).
6. Weekly access review: on-call lead reviews all grants in the last week.

## 6. Web-app data-handling rules

- Never render P1 without masking unless the caller has `pii.read.strict` — the API is the last line of defense; UI is defense-in-depth.
- Redact clipboard writes of P1 fields (`onCopy` handler intercepts + toasts "Sensitive field — copy is disabled").
- Detect print + screenshot attempts (Page Visibility API + `beforeprint`) and log them as `client_events`.
- Session inactivity → auto-lock at 15 min; auto-sign-out at 30 min. Re-auth required.
- Watermark P1-heavy pages with the current user's email (deters photo leaks).

## 7. Deletion vs. anonymization

Given the DPA + audit tension:

- **Anonymize by default.** Financial + operational rows keep their IDs and structure; PII columns get nulled or hashed with a per-tenant salt.
- **Delete on erasure request** — for the specific rows where retention has expired *and* no legal hold applies.
- **Cascade rules** — deleting a `User` does NOT delete their `AttendanceEvent` history (needed for auditor + child welfare); it anonymizes the `User` and keeps events referencing the anonymized row.

The `RetentionPolicy.action` enum (`delete` / `anonymize` / `archive`) declares the intent per resource per tenant. `archive` moves the row to a compressed cold table in the same DB, readable by `audit.view` only.

## 8. Where the classification is enforced

- **Schema** — Prisma `///` tags → generated `docs/data-inventory.md` on CI.
- **API** — `@Sensitive(tier)` decorator on DTOs → interceptor drops those fields for callers without the matching permission.
- **DB** — column-level GRANTs on Postgres roles (`safari_readonly_masked`, `safari_readonly_full`).
- **Client** — `<Sensitive>` component that renders a mask unless the current user is authorized; also disables copy/print/screenshot.

## Checklist for new features

When you touch data, before you PR:

- [ ] Every new PII column has a `/// @data.category` tag
- [ ] Every new table has a `/// @data.tier P0..P4` tag
- [ ] Masking rule added to `ops/masking/mask.sql` (or explicit skip justified)
- [ ] Retention policy specified in `RetentionPolicy` seed
- [ ] Consent purpose(s) linked in `Consent`
- [ ] Web UI wraps PII in `<Sensitive>`
- [ ] Tests cover: unauthorized user sees mask, authorized sees clear
