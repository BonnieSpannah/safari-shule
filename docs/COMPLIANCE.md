# Compliance — Safari Shule (Kenya)

The regulatory perimeter Safari Shule must respect out of the box.

## 1. Kenya Data Protection Act 2019 (DPA) & ODPC

**Regulator:** Office of the Data Protection Commissioner (ODPC).
**Registration:** every tenant with more than 10 employees or handling children's data must register as a **Data Controller** and each software vendor as a **Data Processor**. Registration fee KES 4,000 for micro / KES 20,000 mid / KES 40,000 large per two-year cycle.

### What we implement

| Requirement | Where it lives |
|---|---|
| **Lawful basis + purpose limitation** | `Consent` model with `purpose` enum, `legalBasis` string, `version`, `evidencePayload` (form snapshot) |
| **Consent — granular + withdrawable** | Per-purpose row; `withdrawnAt` timestamp; withdrawal API auto-writes to `DoNotContact` |
| **Data Subject Rights (access / rectification / erasure / portability / objection / restrict processing)** | `DataSubjectRequest` model with `kind`, statutory 30-day `dueBy`, `fulfilledAt`, `auditPayload` (evidence of action) |
| **Right to be forgotten** | `RetentionPolicy.action = anonymize` by default (irreversible tokenization of PII while keeping non-identifying rows for audit); `delete` for records without legal-hold |
| **Legal hold** | `RetentionPolicy.legalHold = true` blocks anonymization until manually released |
| **Purpose-bound retention** | Per-resource retention policies enforced by scheduled job |
| **Cross-border transfer safeguards** | Backup target allowlist (`S3 eu-west`, `S3 af-south`, `GDrive tenant-owned drive`) — no US-only regions without a documented adequacy decision |
| **Breach notification** | Incident kind `data_breach` triggers a mandatory 72h reporting workflow → email to DPO + PDF report generator |
| **Records of processing activities (RoPA)** | Auto-generated from schema tags: every model annotated with `/// @data.category` and `/// @data.retention_days` |
| **DPIA (Data Protection Impact Assessment)** | `Dpia` records per feature; templated markdown + risk score |

### Data categories (tags applied to every model)

- `identity` — name, DOB, ID number, biometrics
- `contact` — phone, email, address
- `location` — GPS pings, home stop
- `financial` — M-Pesa numbers, bank details, receipts
- `health` — allergies, medical alerts, incidents involving harm
- `education` — grades, attendance, disciplinary
- `credentials` — password hashes, tokens, RFID secrets
- `operational` — logs, audit, telemetry

Retention defaults:

| Category | Default retention (post-relationship-end) | Rationale |
|---|---|---|
| `credentials` | 30 days | Only long enough to close sessions |
| `location` | 90 days | Investigative window; parents can extend for legal reasons |
| `contact` | 3 years | Contract law + normal follow-up |
| `financial` | 7 years | KRA + Companies Act |
| `identity` (adults) | 3 years | Contract law |
| `identity` (children) | Until 21st birthday | UN CRC + Children Act 2022 |
| `health` | 10 years | Standard health record retention |
| `education` | 7 years post-graduation | MoE guidance |
| `operational` audit | 5 years | Companies Act + auditor requirements |

## 2. Do Not Contact (DNC) registry

Model: `DoNotContact` — per-tenant, per-channel opt-out.

- **Channels:** `sms`, `email`, `push`, `voice`, `all`
- **Reasons:** `user_request`, `regulatory`, `bounce`, `complaint`, `quiet_hours`
- **Enforcement:** `CommunicationsService.send()` calls `DncGuard.check(tenantId, channel, destination)` **before** enqueuing. A rejection is written as `OutboundMessage.status = 'suppressed'` with the reason.
- **Quiet hours:** every tenant configurable window (default 21:00–06:00 EAT) — enforced by a `DncReason.quiet_hours` filter that expires at window end. Emergency (SOS) messages bypass with an explicit `severity = critical` override.
- **User-facing:** every SMS footer contains `Reply STOP to opt out`. Every email has an `Unsubscribe` link (signed JWT, single-purpose).
- **Withdrawal of consent** auto-creates a matching `DoNotContact` row.

## 3. KRA compliance

**Regulator:** Kenya Revenue Authority (KRA).

### PIN validation

- Every `Tenant`, `Staff`, `Parent` with a `kraPin` field goes through `KraPinValidator` → hits KRA's PIN Checker API (or iTax lookup when available). Result cached 30 days.

### PAYE / NHIF / NSSF / SHIF / Housing Levy

- Computed monthly from `Payslip` (staff × contract × pay period).
- Rates versioned in `packages/shared-types/src/statutory/rates-ke.ts` — updated by finance law changes.
- **2026 rate set** (as at cutover): PAYE bands 10 / 25 / 30 / 32.5 / 35 %, personal relief KES 2,400/mo, NHIF replaced by **SHIF** at 2.75 % of gross (min KES 300), NSSF Tier I + II per NSSF Act 2013 amendment, Affordable Housing Levy 1.5 % employee + 1.5 % employer, Housing Fund Levy retained for existing schemes.

### eTIMS (Electronic Tax Invoice Management System)

**Since Sept 2023 mandatory** for all businesses, including schools charging any fees.

- Every `Receipt` and `Invoice` for a taxable event calls `EtimsTransmitService.transmit(invoice)`.
- Payload includes: `PIN`, `BhfID`, `TrdInvcNo`, `RcptTyCd`, `PmtTyCd`, `SalesSttsCd`, item lines with `TaxTyCd` (A / B / E / D for VATable/exempt/etc.).
- Response includes eTIMS unique invoice number + QR payload — persisted on the invoice, printed on the receipt.
- Retry queue with exponential backoff (KRA's endpoint is famously flaky). Failures escalate to finance-admin after 3 attempts.
- Void via `etims.void` permission → issues an eTIMS credit note referencing the original.

### Tax Compliance Certificate (TCC)

- `kra.tcc.check` permission runs an on-demand check per tenant.
- Auto-flags renewal ≤ 30 days before expiry.

### Statutory returns

| Return | Frequency | Deadline | Producer |
|---|---|---|---|
| PAYE (P10) | monthly | 9th of following month | `statutory-returns.paye.file` |
| NSSF (Form NSSF 3) | monthly | 15th | `statutory-returns.nssf.file` |
| SHIF | monthly | 9th | `statutory-returns.shif.file` |
| Housing Levy | monthly | 9th | `statutory-returns.housing-levy.file` |
| P9 (employee annual) | yearly | Feb 28 | `payroll.print` — PDF + email |
| P10A / P10B / P10C | as needed | — | on-demand exports |
| VAT (VAT3) | monthly | 20th | `reports-finance.export` — school tuition is generally exempt (Sch. I, Para 1) but non-tuition sales are VATable |
| Corporate tax return | yearly | 6 months after FY end | Handled by tenant's accountant using our export |

All returns generated as (a) KRA-approved CSV / XLSX for iTax upload AND (b) human-readable PDF summary.

## 4. Children Act 2022 + UN CRC

- Any user record with role `student` and `dateOfBirth` implying <18 gets the `minor` flag.
- Minor records have stricter defaults: no marketing consent, no third-party sharing, location visible only to `parent` + `caretaker` + `driver` of assigned trip.
- Photos + video require explicit `photo_video` consent from **primary guardian**.

## 5. NTSA compliance

**National Transport & Safety Authority.**

- `Vehicle` records include: chassis, engine, year, inspection expiry, PSV license expiry, road service license, comprehensive insurance expiry.
- `Ntsa.inspection.record` — logs inspection outcomes.
- Alerts:
  - 30 days before insurance / inspection / PSV expiry → tenant admin email + SMS
  - 7 days before → daily digest
  - Day of expiry → banner in the ops console + block dispatch of that vehicle
- `Driver` records track: DL number, DL classes, endorsement expiry, PSV badge expiry, defensive-driving certificate.

## 6. NEMIS

**National Education Management Information System.**

- `Student.nemisUpi` (Unique Personal Identifier) captured at admission.
- Export in NEMIS-required CSV structure for annual returns.

## 7. Ministry of Education, County government

- School registration number persisted per tenant.
- County business permit + parking levy tracked as line items in the accounts module.

## 8. Anti-Money Laundering (POCAMLA) — light

Not directly applicable to school fees, but the payment module rejects payments from sanctions-list phone numbers and flags any single receipt > KES 1,000,000 for manual review + CBK reporting workflow.

## 9. Certifications on the roadmap

- **ISO/IEC 27001** — ISMS scope: Safari Shule production platform. Preparing controls documentation from day one.
- **ISO/IEC 27701** — privacy extension.
- **SOC 2 Type II** — for tenants expecting international audit trails.
- **PCI DSS SAQ-A** — only if we onboard a card processor. M-Pesa alone does not trigger it.

## 10. Where each policy lives (one-liner map)

| Policy | File |
|---|---|
| Data retention (canonical) | `docs/policies/RETENTION.md` (M2) |
| Privacy notice (parents) | `docs/policies/PRIVACY-NOTICE-PARENTS.md` (M2) |
| Privacy notice (staff) | `docs/policies/PRIVACY-NOTICE-STAFF.md` (M2) |
| Cookie / tracking notice | `docs/policies/COOKIES.md` (M2) |
| Terms of Service | `docs/policies/TOS.md` (M2) |
| Acceptable Use | `docs/policies/AUP.md` (M2) |
| Vendor DPA template | `docs/policies/DPA-TEMPLATE.md` (M2) |
| Incident response | `docs/policies/INCIDENT-RESPONSE.md` (M2) |
| Access review cadence | `docs/policies/ACCESS-REVIEW.md` (M2) |

Every policy above is version-controlled markdown, PDF-rendered by the reports engine on release, and signed by the DPO/CEO with a cryptographic timestamp (using `openssl ts` against `freetsa.org` or a Kenyan TSA when available).
