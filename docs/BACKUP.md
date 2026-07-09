# Backup & Disaster Recovery — Safari Shule

Every backup is **signed, encrypted, versioned, and tested by restoration** — not by wishful thinking.

## Objectives

| Metric | Target |
|---|---|
| **RPO** (max data loss) | 5 minutes |
| **RTO** (time to recover) | 1 hour to warm standby · 4 hours cold |
| **Backup success SLA** | 99.9 % over rolling 30 days |
| **Restore drill cadence** | monthly (staging), quarterly (prod → isolated verify env) |

## What we back up

| Asset | Kind | Frequency | Target | Retention |
|---|---|---|---|---|
| PostgreSQL | `pg_dump --format=custom` (logical, full) | daily 01:00 EAT | S3 + Google Drive + local NAS | 30 daily, 12 weekly, 24 monthly, 7 yearly |
| PostgreSQL WAL | `pg_receivewal` streaming | continuous | S3 (immutable object lock) | 7 days |
| PostgreSQL base | `pg_basebackup` (physical) | weekly Sun 02:00 | S3 | 4 weeks |
| Redis | `BGSAVE` snapshot + AOF | hourly | S3 | 24 hourly + 7 daily |
| Files (uploads / reports) | `s3 sync` cross-region | continuous | S3 replication + Google Drive nightly | mirrored + 90 day cold |
| Secrets (env, keys) | HashiCorp Vault / AWS Secrets Manager | continuous | HSM-backed KMS | version history 90 days |
| Audit + `client_events` | Cold-archive after 12 months | monthly | S3 Glacier | 5 years hot, 12 years cold |
| Docker images | GHCR + cosign signatures + syft SBOM | on merge | GHCR + Zot secondary | 100 tags |

## Encryption

- **In transit** — TLS 1.2+ everywhere; presigned S3 URLs are HTTPS-only.
- **At rest** — AES-256-GCM per backup file with a per-tenant data key (envelope encryption). KMS masters:
  - Prod: AWS KMS `alias/safari-shule-prod-backups` (multi-region)
  - Staging: separate key
  - Local: `DATA_ENCRYPTION_KEY` env var (dev only)
- **Key rotation** — masters yearly, data keys per backup. Old data keys retained for restore of historical backups.

## Backup targets

We support three targets in parallel so a single-provider outage never wipes the recovery path.

| Target | Env var | Notes |
|---|---|---|
| **AWS S3** | `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, `BACKUP_S3_KMS_KEY_ID` | Object Lock in Governance mode, versioning on |
| **Google Drive** | `BACKUP_GDRIVE_FOLDER_ID`, `BACKUP_GDRIVE_SA_JSON` (service account) | Shared drive per tenant; readable only by the tenant's designated admin + a Safari Shule DR account |
| **Local NAS / disk** | `BACKUP_LOCAL_PATH` | Optional — for on-prem tenants or air-gapped drills |
| **Backblaze B2 / GCS** | `BACKUP_B2_BUCKET` / `BACKUP_GCS_BUCKET` | Alternative primary for cost-sensitive tenants |

Every backup job writes a row into `backup_jobs` with `kind`, `target`, `sizeBytes`, `checksumSha256`, `encryptionKeyId`, `location`, `retentionDays`, `status`.

## Producers (BullMQ workers, M2)

| Queue | Cron | Consumer |
|---|---|---|
| `backup.pg.logical.full` | `0 1 * * *` (daily) | `PgDumpWorker` |
| `backup.pg.wal` | continuous | `WalStreamWorker` (long-running) |
| `backup.pg.base` | `0 2 * * 0` (weekly) | `PgBaseBackupWorker` |
| `backup.redis` | `0 * * * *` (hourly) | `RedisSnapshotWorker` |
| `backup.files` | `*/15 * * * *` (15 min) | `S3SyncWorker` |
| `backup.retention.reap` | `0 3 * * *` (daily) | `RetentionReaperWorker` — deletes / purges by policy |
| `backup.drill` | `0 4 1 * *` (monthly 1st) | `RestoreDrillWorker` — restores latest backup into isolated Postgres, runs `select count(*)` sanity, records result |

## Notifications

- **Success** — one line in the daily backup digest email at 08:00 EAT.
- **Failure** — immediate:
  1. Email to `ops@safari-shule.co.ke` + designated tenant admin
  2. SMS to the on-call phone
  3. GlitchTip / Sentry event with `severity=error`
  4. Grafana alert firing (`safari_backup_last_success_age_seconds > 3600`)
- **Silent failure guard** — if no successful backup landed for >26h, ops on-call is paged (PagerDuty / OpsGenie in prod).

## Restoration — canonical procedure

### Scenario A: full logical restore (data corruption or ransomware)

```bash
# 1. Bring up an ISOLATED Postgres (never restore over prod without a copy)
docker run -d --name pg-restore -e POSTGRES_PASSWORD=... postgis/postgis:16-3.4

# 2. Fetch the most recent daily
BACKUP_ID=<uuid from backup_jobs>
./ops/backup/fetch.sh --id "$BACKUP_ID" --out /tmp/restore.pgc

# 3. Decrypt
DATA_KEY=$(./ops/backup/kms-decrypt.sh --key-id "$(jq -r .encryptionKeyId /tmp/restore.meta.json)")
openssl enc -d -aes-256-gcm -K "$DATA_KEY" -iv "$(jq -r .iv /tmp/restore.meta.json)" \
  -in /tmp/restore.pgc.enc -out /tmp/restore.pgc

# 4. Verify checksum
sha256sum /tmp/restore.pgc  # must match backup_jobs.checksumSha256

# 5. Restore
pg_restore --dbname="postgresql://postgres:...@localhost:5432/postgres" \
  --create --clean --if-exists --no-owner --no-privileges /tmp/restore.pgc

# 6. Point-in-time replay (if PITR needed)
./ops/backup/pitr-replay.sh --target "2026-07-09T14:32:00Z"

# 7. Validate: row counts, checksums per critical table
./ops/backup/validate-restore.sh --report /tmp/report.md

# 8. If green: swap the connection string; announce on ops channel.
```

### Scenario B: single-tenant restore (accidental delete)

Even the ORM `.deleteMany` is guarded, but for full-tenant recovery:

```bash
# 1. Restore backup into a SIDECAR Postgres (never over prod)
# 2. Extract just the tenant's rows:
./ops/backup/tenant-extract.sh --tenant-slug=hillcrest --backup-id=<id> --out /tmp/hillcrest.sql

# 3. Review the SQL (peer-approved)
# 4. Apply to prod inside a transaction with row-level filters
psql "$DATABASE_URL" -f /tmp/hillcrest.sql
```

Every tenant restore requires two-person approval and is recorded as an `audit_log` entry with `bypass=true`.

### Scenario C: cross-region failover

Managed via Terraform (M6). Warm standby in AWS `af-south-1` receives WAL streaming from `eu-west-1`. Failover flip via `./ops/dr/failover.sh` — cuts DNS, promotes standby, updates connection strings, notifies ops.

## Aging / retention & cleanup

Every backup carries `retentionDays`. The `RetentionReaperWorker` daily:

1. Loads all `backup_jobs` where `finishedAt + retentionDays < now()`.
2. Skips any tagged with `legalHold = true`.
3. Deletes the artifact at its `target`.
4. Updates `status = purged` + `updatedAt`.
5. Writes a summary row to `audit_log`.

Logs, `client_events`, `audit_log` older than tier retention:

- Hot (Postgres): rolled to Parquet on S3 monthly, dropped from Postgres.
- Cold (Glacier): purged after 5 / 7 / 12 years per category retention.

## Drill program — "no untested backup"

Every month:

1. `RestoreDrillWorker` fires at 04:00 on the 1st.
2. Pulls the latest prod daily into an isolated Postgres container.
3. Runs the smoke pack: 
   - `SELECT count(*) FROM tenants` matches source
   - Deterministic per-table row count check (± 5 %)
   - Sample query for each tenant (parent login sample)
4. Result row in `backup_jobs.status`; failure pages on-call.

Quarterly, ops runs a **full manual drill** against a paying tenant's production data restored to an isolated region — with the tenant's written consent and a two-day retention on the drill DB before scrub.

## What NOT to do (learned the hard way in industry)

- ❌ Restore straight into prod without a copy. Always sidecar first.
- ❌ Rely on a single provider (S3-only, GDrive-only). Always ≥ 2 targets.
- ❌ Store encryption keys next to the ciphertext.
- ❌ Skip `pg_verifybackup` on physical backups.
- ❌ Assume a healthy `pg_dump` = restorable. Only a successful `pg_restore` counts.
- ❌ Log the KMS decryption call payload — it leaks key metadata.
- ❌ Give the backup role write access to production. One-way only.

## Runbook shortcuts (Makefile — M2)

```
make backup                    # trigger a full logical backup on demand
make backup:list               # tail of backup_jobs table
make backup:verify ID=<uuid>   # re-run checksum + test restore
make restore:isolated ID=<uuid># restore into ./ops/restore-sidecar
make db:masked-dump            # dump prod with PII masked (see DATA-CLASSIFICATION.md)
```
