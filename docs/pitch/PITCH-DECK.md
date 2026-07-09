# Safari Shule — Investor Pitch Deck

> A polished, print-and-present narrative. Read top-to-bottom or lift individual slides into Google Slides / Keynote.
> Rendered at every release into `docs/pitch/SafariShule-Deck.pdf` (M4).

---

## Slide 1 — Cover

# **Safari Shule**
### The trust layer for Kenyan school transport

**One platform. Many schools. Every parent knows their child is safe.**

*Investor deck · Seed round · v1.0 · 2026*

---

## Slide 2 — The problem

Every school day in Kenya, **1.4 million children** ride to school in a bus, van, or matatu.
Their parents get **zero visibility**.

- Parents rely on **WhatsApp groups** and **phone calls** to know if a child boarded.
- Schools chase **fee arrears** by hand — tuition + transport separately.
- Drivers keep **paper logs** for fuel, repairs, insurance renewals; 40% of PSV vehicles are cited annually by NTSA.
- **eTIMS is mandatory** since 2023 for every receipt — most schools still issue paper.
- The **DPA 2019** and **Children Act 2022** demand controls that no school has today.

*"When it rains and my daughter is late, I don't know if she is on the road or at school." — parent, Nairobi.*

---

## Slide 3 — Who feels this most

| Persona | Pain |
|---|---|
| **Parent** | No visibility. Missed calls. Late-fee scares. Trust deficit. |
| **School bursar** | Manual M-Pesa reconciliation, 3–5 days per month lost. |
| **Transport manager** | No fleet dashboard. Missed insurance/inspection renewals = fines. |
| **Driver / conductor** | Paper attendance, panicked phone calls in SOS moments. |
| **Head teacher** | Compliance risk: DPA breach, NTSA audit, KRA penalties. |
| **Government (MoE / NTSA / KRA)** | No pipeline of standardized data from ~40,000 school vehicles. |

---

## Slide 4 — The solution

**Safari Shule** is a mobile-first, multi-tenant SaaS that runs a school's entire transport operation.

- Live bus map — parents watch their child's bus in real time.
- RFID boarding scans — instant "child boarded" push at the school + parent app.
- One-tap **SOS** — driver triggers; emergency contacts are notified within seconds; ops sees geo-position.
- **M-Pesa fee collection** — auto-reconciled; parents get an **eTIMS-compliant receipt** the same second.
- **NTSA compliance dashboard** — every vehicle's insurance, inspection, PSV licence tracked; alerts 30 days before expiry.
- Full **HR + payroll** module — PAYE, SHIF, NSSF, Housing Levy computed automatically; P9 issued at year end.
- **DPA 2019 compliant** by design — consent registry, DSR workflows, retention policies, data-subject rights.

Everything above lives in one app, on one number-portable domain per school, on Android + iOS + web + desktop.

---

## Slide 5 — Product tour (screenshots)

*Placeholder — screenshots inserted at M4 from the running product.*

- Parent app home — child on live map, next-stop ETA, quick-pay button
- Driver shift screen — accept trip, mark boarding, one-tap SOS
- School admin dashboard — live fleet, KPIs, incident feed, revenue
- Ops incident console — SOS in progress, geo trace, comms log
- Finance module — fees, invoices, eTIMS receipts, statement of account
- Compliance module — NTSA renewals, DPA consents, retention runs

---

## Slide 6 — Why now

1. **Regulatory tailwind.** eTIMS + DPA 2019 + Children Act 2022 all became teeth in 2023–2025. Schools *must* modernize.
2. **Payments infrastructure.** M-Pesa now handles ~KES 30 trillion/year (60% of GDP). STK Push is a 3-tap fee payment.
3. **Smartphone penetration.** ~90% of Kenyan parents in urban and peri-urban schools own a smartphone.
4. **Transport safety spotlight.** Public discourse after highway incidents in 2024–2025 has pushed schools to invest.
5. **Hardware costs fell.** A compliant GPS + RFID unit is now ~KES 8,000 (vs. KES 30,000+ in 2020).

We are five years too early for the mass market and ten years too late for hobbyists. This is *the year*.

---

## Slide 7 — Market size

| Segment | Estimate | Source |
|---|---|---|
| **TAM** — All Kenyan schools running transport | ~4,500 schools · ~40,000 vehicles · ~600k transport-active parents | KNBS + MoE 2024 |
| **SAM** — Urban/peri-urban private + top-quintile public running formal transport ops | ~1,800 schools · ~15,000 vehicles · ~350k parents | Estimated |
| **SOM (5-yr)** — What Safari Shule can capture | 500 schools · ~3,500 vehicles · ~150k parents | Bottom-up plan |

Adjacent (post-Kenya): Uganda, Tanzania, Rwanda, Ethiopia — similar transport pain, same M-Pesa-analog rails (Airtel Money, MTN MoMo, telebirr). **Serviceable East Africa TAM: ~2× Kenya.**

---

## Slide 8 — Competition

| Competitor | Category | Fit vs. Kenya |
|---|---|---|
| **Zeraki, EduCloud KE, Elimu** | School ERP | Strong on academics; weak on transport, no live tracking, no compliance |
| **ZuluTrack, EasyTrack** | Fleet GPS | Fleet-only; no parent app, no fees, no compliance stack |
| **Uber for Schools (informal)** | Ad-hoc | No trust, no records, no compliance |
| **Ecole Direct, Schoolzone (imported)** | Global ERP | Wrong fit — no M-Pesa, no eTIMS, no NTSA logic |
| **WhatsApp + spreadsheet** | Today's default | Free, but zero safety, trust, compliance |

**We win because we own the intersection**: Kenyan compliance + transport-first + parent-friendly + hardware-integrated.

---

## Slide 9 — Business model & unit economics

**SaaS + hardware + transaction fees.**

- **SaaS subscription** — see [PRICING.md](PRICING.md). Modest tiers by number of vehicles + students.
- **Hardware** — RFID readers (KES 8,500 unit) + GPS trackers (KES 6,500 unit). Sold at cost + 15%.
- **Transaction fees** — 0.5% on M-Pesa fee collection (schools save 3–5x that in manual labour saved).
- **Professional services** — data migration, training, custom reports. Low volume, high margin.

### Illustrative unit economics — a mid-tier school (500 students, 8 buses)

| Line | Monthly |
|---|---|
| SaaS (Growth tier) | KES 14,900 |
| SMS overage (parents opted in) | KES 2,200 |
| M-Pesa transaction share (~KES 4M collected × 0.5%) | KES 20,000 |
| **Blended monthly ARR** | **~KES 37,100** |
| **Annual ARR** | **~KES 445,000** |

- **CAC** — target < KES 90,000 (via school-network + county-education-office channel).
- **Gross margin** — 75% at scale (SMS + M-Pesa costs pass-through; hosting fixed).
- **Payback** — ≤ 3 months.

---

## Slide 10 — Traction & milestones

*(Fill in as we sign schools; below is the 12-month plan)*

| Quarter | Milestone |
|---|---|
| Q3 2026 | 3 pilot schools live · 800 parents onboarded · SOC 2 Type I in flight |
| Q4 2026 | 15 paying schools · KES 5M ARR run-rate · Play Store + App Store launch |
| Q1 2027 | 40 schools · MoE MoU signed · NTSA data pilot |
| Q2 2027 | 100 schools · KES 20M ARR · Series A ready |

Signed pilot letters of intent: *(insert scans in appendix)*.

---

## Slide 11 — Product & tech moat

Not "we built an app" — **we built the Kenyan compliance layer.**

- **250+ atomic RBAC permissions** — the only school ERP with a permission model that mirrors real school hierarchy (transport, finance, HR, compliance, ops).
- **Multi-tenant with three-layer isolation** — JWT `tid` + Prisma auto-scoping + Postgres RLS. Never a cross-tenant leak.
- **eTIMS-native invoicing** — every fee receipt hits KRA the same second.
- **Hardware-signed ingestion** — HMAC-SHA256 + AES-256-GCM at rest for device secrets. RFID readers are hot-swappable and rotate secrets in-band.
- **Offline-first mobile** — SOS works with zero bars; syncs on reconnect.
- **DPA 2019 built in** — consent registry, DSR workflow, retention policies, right-to-be-forgotten — from day one, not bolted on.
- **Government-ready** — a single API contract with MoE for NEMIS, NTSA for fleet compliance, KRA for tax.

Docs: [ARCHITECTURE.md](../ARCHITECTURE.md), [COMPLIANCE.md](../COMPLIANCE.md), [SECURITY.md](../SECURITY.md).

---

## Slide 12 — Team

*Placeholder — insert founder + advisor bios.*

Ideal team on day one:
- Founding engineer (backend + infra) — full-stack, has shipped multi-tenant SaaS
- Founding designer + frontend — mobile-first, Flutter fluent
- Founding sales / school partnerships — ex-school head or MoE relationship
- Founding compliance / DPO — legal background, ODPC-network
- Advisors — one school owner, one NTSA insider, one M-Pesa alum, one Kenyan angel investor

---

## Slide 13 — Financial ask

**Seed round: KES 50,000,000 (~USD 350,000) at KES 300M pre-money.**

Deployed over 18 months:

| Bucket | KES | Purpose |
|---|---|---|
| Engineering (3) | 24M | Ship M2–M8, plus hardware firmware |
| Sales & partnerships (2) | 10M | 100 schools by Q2 2027 |
| Compliance & policy | 3M | ODPC / MoE / NTSA / KRA relationships |
| Marketing | 5M | Content, school-network events, parent education |
| Hardware inventory | 4M | 500 RFID + 500 GPS units ($8/unit COGS) |
| Runway buffer | 4M | 6-month buffer |

**Milestone gates for Series A:** 100 schools · KES 20M ARR · 90% gross margin on SaaS line · signed MoU with two counties · SOC 2 Type II certified.

---

## Slide 14 — Roadmap

Full sequenced plan in [../ROADMAP.md](../ROADMAP.md). Highlights:

- **Now** — Web MVP shipping, mobile alpha in Q3 2026, first paid tenants Q4 2026
- **6 months** — Full finance + HR + statutory returns; NTSA integration
- **12 months** — Regional expansion pilot (Uganda + Tanzania); parent super-app features (school marketplace)
- **24 months** — Bank + insurance partnerships; parent-facing credit line for fees (via a licensed partner)
- **36 months** — Series A close; 1000-school target; regional HQ

---

## Slide 15 — Impact

- **Every child, tracked to school.** Not surveillance — safety.
- **Every parent, informed.** No more phone chains. No more "is she on the bus?"
- **Every school, compliant.** eTIMS · DPA · NTSA · NEMIS · KRA — one platform.
- **Every driver, respected.** Digital timesheets, transparent pay, statutory deductions correctly applied.
- **Every KES accounted for.** Fee collection reconciled the same day.
- **Every incident, auditable.** Immutable, timestamped, court-defensible.

This is what a modern Kenyan school runs on.

---

## Slide 16 — The ask

We are looking for:

1. **Capital** — KES 50M seed to reach 100 schools + Series A readiness.
2. **Partnerships** — with a school network (SBP, CBC-network chains), a fleet insurer, and one county government.
3. **Advisors** — an ex-Safaricom exec, an MoE alumnus, a school-owner-turned-operator.

**Contact:** *(founder email + phone + Calendly)*

**Live demo:** *(URL — dev environment, credentials on request)*

---

## Slide 17 — Appendix

- [Product brochure](PRODUCT-BROCHURE.md) — school-facing one-pager
- [Pricing](PRICING.md) — tiers + comparison + FAQs
- [Government brief](GOVERNMENT-BRIEF.md) — MoE / NTSA / county partnership pitch
- [Architecture](../ARCHITECTURE.md) — technical overview
- [Compliance](../COMPLIANCE.md) — DPA / KRA / NTSA / NEMIS posture
- [Roadmap](../ROADMAP.md) — sequenced milestones M0–M15
- [Security](../SECURITY.md) — threat model + OWASP mapping
- [Backup & DR](../BACKUP.md) — continuity commitments
