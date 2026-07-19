# DevSecOps — Safari Shule

Security is not a gate at the end; it's woven through every commit.

## 1. Shift-left security controls (CI / pre-merge)

Every PR must pass, no exceptions:

| Control | Tool | Where |
|---|---|---|
| Secret scanning | **gitleaks** | pre-commit hook + CI `secret-scan.yml` |
| SAST — TS/JS | **CodeQL** (`javascript-typescript` pack) | `codeql.yml` (weekly + on PR to `main`) |
| SAST — Dart (mobile) | **dart analyze --fatal-infos** + **dcm** custom lints | `mobile-ci.yml` |
| Dependency vuln scan | **GitHub Dependabot** + **trivy fs** | `dependency-review.yml` |
| Container CVE scan | **trivy image** + **grype** | `build-image.yml` (blocks HIGH+ unless suppression documented) |
| Container SBOM | **syft** → SPDX JSON attached as build artifact | `build-image.yml` |
| Container signing | **cosign** with keyless OIDC (GHA) | `build-image.yml` |
| License compliance | **licensee** + allowlist | `license-check.yml` |
| Coverage gates | Jest / Vitest | `ci.yml` — see [TESTING.md](TESTING.md) |
| Mutation testing | **Stryker** | `mutation-weekly.yml` (auth, payments, hardware) |
| DAST | **OWASP ZAP baseline** | `dast.yml` — runs against preview envs |
| Prisma diff | `prisma migrate diff` | `db-migration-check.yml` — blocks destructive without `allow-destructive` label |
| IaC scan | **checkov** (Terraform, when introduced) | `iac-scan.yml` |
| Commit signing | **SSH-signed commits** | branch protection setting |

Full workflow inventory in [ROADMAP.md](ROADMAP.md) — sequenced under M6.

## 2. Branch protection (M6)

Enforced on `main`, `staging`, `production` (reproducible via `gh api`):

- Linear history required.
- Signed commits required (SSH signing).
- No force-push.
- No admin bypass.
- Required reviews: 1 for regular paths, **2** for paths in `CODEOWNERS`:
  - `apps/api/src/auth/**`
  - `apps/api/src/modules/payments/**`
  - `apps/api/src/modules/hardware/**`
  - `apps/api/prisma/**`
  - `docs/COMPLIANCE.md`, `docs/DATA-CLASSIFICATION.md`, `docs/SECURITY.md`
- Required status checks: typecheck, lint, unit, integration, e2e, patch-coverage, prisma-diff, gitleaks, trivy, codeql.
- Environment approval gate on `production` deploys (physical human approval).

## 3. Container strategy — build once, promote the digest

```
PR merge → build-image.yml
  ├─ multi-stage Dockerfile (deps → build → runtime distroless)
  ├─ non-root user (uid 10001)
  ├─ read-only root filesystem
  ├─ trivy scan → block HIGH+
  ├─ syft SBOM → SPDX attached
  ├─ cosign sign (keyless OIDC + Fulcio) → attach signature
  ├─ push to ghcr.io/bonniespannah/safari-shule/{api,web}:sha-<short>
  └─ record image digest in deployments table
```

Downstream envs (`deploy-dev`, `promote-staging`, `promote-production`) pull **by digest**, verify cosign signature, then deploy. The Kubernetes admission controller (Kyverno) rejects any image without a valid signature.

## 4. Runtime security

- **Read-only root filesystem** on all containers. Ephemeral scratch in `tmpfs`.
- **Non-root user** everywhere. Capabilities dropped to `NET_BIND_SERVICE` only (or none if using `>1024` ports).
- **NetworkPolicy** — default-deny. Egress allowlist: DB, Redis, KMS, AT + M-Pesa endpoints only.
- **Seccomp** — `RuntimeDefault` profile.
- **AppArmor** — `runtime/default` (Linux).
- **Pod security standard** — `restricted`.
- **Distroless** base for the API container; nginx `slim` for web.
- **Rate limits at three layers** — nginx (per-IP), NestJS `ThrottlerGuard` (per-route), and BullMQ concurrency for outbound work.

## 5. Secrets management

- **Local dev** — `.env`, git-ignored, generated from `.env.example`.
- **CI** — GitHub Environments with required-reviewer approval on `production` env.
- **Runtime** — HashiCorp Vault (preferred) or AWS Secrets Manager. Injected via IRSA / Workload Identity — never baked into images.
- **Rotation** — quarterly for JWT secrets; annually for KMS masters; per-provider cadence for AT / M-Pesa keys.
- **In code** — reference by name via `@nestjs/config`. Never `process.env.FOO` outside `src/config/*`.
- **Detection** — gitleaks pre-commit + `truffleHog` in CI + weekly full-history scan.

## 6. Identity & access

- **Human access** — SSO (Google Workspace / Microsoft Entra) with mandatory FIDO2 (WebAuthn) for anyone touching prod.
- **Service access** — short-lived tokens via OIDC federation. No long-lived credentials.
- **Break-glass** — 2-of-3 Shamir-shared static credentials in a physical safe. Every use requires DPO + CEO sign-off and a post-mortem.
- **Access reviews** — quarterly. Automated pull of every human + service principal with prod access → owner review → decisions logged.

## 7. Threat modelling

STRIDE per feature before it lands. Template in `docs/security/THREAT-MODEL-TEMPLATE.md` (M2). Mandatory for:

- Auth changes
- Payment flow changes
- Hardware ingestion changes
- Cross-tenant paths

Reviewed by two of: DPO, security lead, tech lead.

## 8. Penetration testing

- **Internal** — every major release; scope defined per release.
- **External** — annually + before any new statutory / financial certification.
- **Bug bounty** — private program (HackerOne) once we hit 25 tenants; scope, safe-harbour clause, and rewards published at `docs/security/BUG-BOUNTY.md` (M6).

## 9. Vulnerability disclosure

- `SECURITY.txt` at `/.well-known/security.txt` — `mailto:security@safarishule.co.ke`.
- Response SLA: 48h acknowledgement, 14 days fix-or-mitigation plan.
- Coordinated disclosure preferred; credit given if requested.

## 10. Incident response (security-specific)

Reference incidents playbook: `docs/security/INCIDENT-PLAYBOOK.md` (M2). At-a-glance:

1. **Detect** — Grafana alert, GlitchTip / Sentry event, external report.
2. **Triage** — severity assessment by on-call security lead.
3. **Contain** — revoke tokens, rotate keys, block the actor, isolate the affected resource.
4. **Eradicate** — remove the vulnerability.
5. **Recover** — restore service; verify no persistent access.
6. **Notify** — ODPC within 72h for personal-data breaches; affected data subjects if criteria met; tenants within 24h of confirmed impact.
7. **Learn** — blameless post-mortem within 10 business days.

## 11. Supply-chain

- Dependencies pinned exactly (no `^` in `package.json` for security-critical libs — enforced by lint rule).
- Renovate bot with security-only PRs merged fast.
- **Provenance** — SLSA level 3 target (M6). Every artifact has verifiable provenance back to a specific commit + GHA workflow run.

## 12. Data protection controls (see also DATA-CLASSIFICATION.md)

- Encryption at rest — AES-256-GCM column-level for secrets, TDE-equivalent at storage layer.
- Encryption in transit — TLS 1.2+ everywhere.
- Key management — envelope encryption with per-tenant data keys; masters in KMS/HSM.
- Backup encryption — see [BACKUP.md](BACKUP.md).

## 13. Compliance mapping

Every control above maps to at least one framework requirement. Full matrix in `docs/security/CONTROL-MATRIX.md` (M4) covering:

- ISO/IEC 27001:2022 Annex A
- ISO/IEC 27701:2019
- SOC 2 CC1–CC9
- Kenya DPA 2019 §§ 25–41
- OWASP Top 10 (2021 + 2024)
- CIS Kubernetes Benchmark
- CIS Docker Benchmark

## 14. DevSecOps cadence

| Cadence | Activity |
|---|---|
| Every commit | Pre-commit hooks, gitleaks, format |
| Every PR | Full CI (SAST, tests, coverage, prisma-diff, license, dependency review) |
| Nightly | Trivy on latest images, dependency updates via Renovate |
| Weekly | CodeQL, Stryker on hot modules, backup restore drill (staging) |
| Monthly | Access review, restore drill (isolated), architecture review of open threat model items |
| Quarterly | Full restore drill from cold, secret rotation, external policy review |
| Annually | Pen test, KMS master rotation, DPIA re-review per feature |

## 15. Culture

- "Security is everyone's job" — every engineer reads this doc + [DATA-CLASSIFICATION.md](DATA-CLASSIFICATION.md) as part of onboarding.
- "See something, say something" — Slack `#security` is a no-blame channel for questions and near-misses.
- Learning budget: every engineer expected to complete at least one security course per year (SANS SEC540 or equivalent).
