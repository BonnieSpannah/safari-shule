# Support & Continuity — Safari Shule

How we run support without breaking trust — and how we keep the platform running when things go sideways.

## 1. Support tiers & response times

| Tier | Who | Response SLA (business hrs, EAT) | Response SLA (24×7 for P1) |
|---|---|---|---|
| **P1 — Outage** | System-wide or tenant-wide down | 15 min | 15 min |
| **P2 — Degraded** | A module (e.g. RFID ingest) failing | 1 hour | 4 hours |
| **P3 — Single user / cosmetic** | One user's login, minor UI issue | 4 hours | next business day |
| **P4 — Question / feature request** | Not blocking | 1 business day | 3 business days |

## 2. Support workflow

```
Tenant reports issue (email / in-app / phone)
    ↓
L1 triage (< 15 min)
    ├─ P1 / P2 → page on-call engineer
    ├─ Known issue → status page + template response
    └─ P3 / P4 → ticket, assigned to on-call queue
    ↓
Reproduce (safe path — see DATA-CLASSIFICATION.md §4)
    ↓
Root-cause + fix + tests
    ↓
Ship → verify → close ticket → post-mortem if P1 / P2
```

## 3. Reproducing user issues without touching their data

**The rules:**

1. Never log in as the user.
2. Never edit the user's data in prod.
3. Never share the user's data in chat, email, or bug tracker.
4. Never take a screenshot of the user's data.

**What to do instead**: use the impersonation flow (§4) or the masked staging replay (§5).

## 4. Impersonation — the only sanctioned way to "become" a user for support

Defined by the `ImpersonationSession` model. The full flow:

1. **Request** — Support engineer submits:
   - `targetUserId` (or targetEmail resolved to id)
   - `reason` (free text, required, ≥ 30 chars, becomes the audit-log breadcrumb)
   - `ticketRef` (JIRA / Freshdesk / etc.)
   - `scope` (subset of the target user's permissions — LEAST privilege)
   - `expiresIn` (max 1 hour)
2. **Two-eyes approval** — a second support / ops user with `support.approve` clicks approve. Same-user approval blocked.
3. **Token minted** — scoped short-lived JWT with `impersonating: true` claim and permissions **intersected** with the requested scope.
4. **In-session UX** — persistent red banner in the web app: "Impersonating <target> · ends in 45:00 · [end session]". Every network call carries an `X-Impersonation-Session-Id`.
5. **Immutable audit** — every request logged twice: once as the normal `audit_log` row (author = support user, impersonating = true), once as a `client_events` row (`kind = impersonation_*`).
6. **Auto-terminate** on: TTL expiry, support user signs out, target user logs in from anywhere (immediate kill), scope exceeded (single wrong request kills the session).
7. **Post-session** — email to the tenant admin (transparency notice). If enabled, a summary PDF is sent to the affected user with a redacted view of actions taken.

### What impersonation cannot do

- Change the target's password → use the normal "reset password" flow initiated by the target or the tenant admin.
- Read credentials-category data (`password_hash`, refresh tokens, RFID HMAC in plaintext).
- Initiate payments on the target's behalf (the `payments.mpesa.initiate` route rejects impersonated tokens).
- Approve its own escalation (self-approval loop broken).
- Cross tenants (the target's `tid` claim is the ceiling).

### Emergency break-glass

For P1 outages where impersonation approval isn't reachable, an `emergency-impersonation` token can be minted by any two people with `emergency.break-glass` — same scope rules, TTL 30 min, and it pages the DPO instantly. Never used for "convenience".

## 5. Masked-staging replay

For issues that reproduce with the data shape but don't need the exact person, this is faster and safer than impersonation.

```bash
# 1. Grab the customer's traceId from their bug report or the audit log:
TRACE=<uuid>

# 2. Export the trace-scoped rows (masked at export):
./ops/repro/pull-trace.sh --tenant hillcrest --trace-id "$TRACE" --out /tmp/trace.json

# 3. Restore masked prod snapshot into staging (weekly nightly does this automatically):
make db:masked-restore

# 4. Replay the trace against staging:
./ops/repro/replay.sh --trace /tmp/trace.json --target https://staging.safari-shule.co.ke

# 5. Reproduce; fix; write a test; ship.
```

## 6. Post-mortems

For every P1 and every P2 that lasted > 2 hours, we write a **blameless post-mortem** within 5 business days. Template lives at `docs/postmortems/TEMPLATE.md` (M2). Must include:

- Timeline (with timestamps to the second)
- Root cause
- Impact (tenants + users affected, minutes of degradation, financial impact)
- What went well (yes, this section is required — it identifies existing controls that worked)
- What went badly
- 3–5 actions with owners and due dates
- A test that would have caught it

Published to `#incidents` channel + linked in the customer status page's history.

## 7. Status page

Public: `https://status.safari-shule.co.ke` (M6). Components:

- API core
- Web console
- Realtime (WebSockets)
- SMS delivery
- Email delivery
- M-Pesa STK Push
- Hardware ingestion
- Reports engine

Statuses: `operational | degraded | partial-outage | major-outage`. Updates go out via email + SMS to subscribed tenant admins.

## 8. On-call rotation

- 24×7 primary + secondary. Weekly handover Monday 09:00 EAT.
- Primary: response < 15 min for P1.
- Secondary: takes over if primary doesn't ack in 10 min.
- Compensating time-off + on-call allowance per rotation.
- Runbook: [RUNBOOK.md](RUNBOOK.md).
- Alert routing: Grafana → OpsGenie / PagerDuty → SMS + call.

## 9. Business continuity (BCP) — the bad-day scenarios

| Scenario | Response |
|---|---|
| Postgres primary loss | Auto-promote standby (see [BACKUP.md](BACKUP.md) §Scenario C). RPO 5 min, RTO 15 min. |
| AWS region loss | DNS failover to `af-south-1` warm standby. RTO 1 h. |
| Africa's Talking down | Automatic SMS provider failover (Twilio → Infobip) — costs more, delivers. |
| M-Pesa down | Queue transactions with backoff; parents see "Awaiting Safaricom — you have not been charged". Auto-retry on recovery. |
| Ransomware / logical corruption | Restore from immutable S3 backup (Object Lock protects from encrypt-by-attacker). |
| Key custodian unavailable | Two of five Shamir-split KMS admin keys distributed geographically. |
| Founder / DPO unavailable | Documented deputies + Vault-stored contact chain. |
| Tenant offboards / disputes | Data export (see below) + verified destruction with certificate. |

## 10. Tenant offboarding

Contractual: 30-day export window, 90-day soft-delete, then hard destroy.

- **Export** — full ZIP: DB extract (JSON per table), file attachments, audit log, consent registry, `client_events`.
- **Destruction** — anonymize retained records per retention policy; delete tenant-scoped rows for resources without retention obligation.
- **Certificate** — signed PDF issued to the tenant admin. Hashes of destroyed artifacts recorded. Attorney-general audit trail retained 12 years.

## 11. Support tooling (M3)

- Read-only "customer view" ops console page (masked by default; toggle reveals with permission).
- One-click "generate repro bundle" — packages recent audit log + `client_events` + relevant rows (masked) + latest error traces into a signed URL.
- Live shadow: pair a support user with an active session; support sees a live feed of client events (no keystrokes captured) with the user's consent.

## 12. What good support looks like

Signals we're doing this right:

- Zero prod password resets via SQL in a rolling year (target: 0).
- < 5 % of tickets require impersonation (target: masked replay handles the majority).
- 100 % of impersonation sessions have a written reason ≥ 30 chars, an approver, and a matching `client_events` trail.
- Median P1 acknowledgement ≤ 5 min.
- Median P2 acknowledgement ≤ 30 min.
- Blameless post-mortem published for every P1/P2 within 5 business days.
