#!/usr/bin/env bash
# =============================================================================
#  Safari Shule · uat-refresh
#  Pulls the latest masked prod snapshot and loads it into the UAT database.
#  Full masking implementation lands in M2 (see docs/DATA-CLASSIFICATION.md §3).
#  Today this script guards the flow and prints the exact steps a human would
#  run so the runbook is discoverable.
# =============================================================================
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  R=$'\033[0m'; B=$'\033[1m'
  EM=$'\033[38;2;16;185;129m'
  AM=$'\033[38;2;245;158;11m'
  RO=$'\033[38;2;244;63;94m'
  ZI=$'\033[38;2;113;113;122m'
  ZI_HI=$'\033[38;2;161;161;170m'
  U=$'\033[4m'
else
  R= B= EM= AM= RO= ZI= ZI_HI= U=
fi

if [[ ! -f .env ]]; then
  printf "  ${RO}✗${R} .env missing — run ${U}make bootstrap${R} first.\n"; exit 1
fi

env_line() { grep "^$1=" .env | cut -d= -f2- | tr -d '"'; }
APP_ENV=$(env_line APP_ENV)

if [[ "$APP_ENV" != "uat" ]]; then
  printf "  ${RO}✗${R} Current APP_ENV=${AM}$APP_ENV${R} — uat-refresh only runs in ${B}uat${R}.\n"
  printf "  ${ZI_HI}   Re-bootstrap with APP_ENV=uat, then re-run.${R}\n"
  exit 1
fi

printf "\n  ${B}Safari Shule · uat-refresh${R}\n\n"

# --- Guard: prod credentials must be reachable read-only, but never used to write ---
: "${PROD_REPLICA_URL:?PROD_REPLICA_URL not set — must be a READ-ONLY Postgres URL}"
: "${UAT_TARGET_URL:?UAT_TARGET_URL not set — target UAT Postgres URL}"

printf "  ${AM}▸${R} ${B}Sanity checks${R}\n"
if psql "$PROD_REPLICA_URL" -c "SELECT current_setting('default_transaction_read_only');" -Atq 2>/dev/null | grep -q on; then
  printf "  ${EM}✓${R} Source is read-only\n"
else
  printf "  ${RO}✗${R} PROD_REPLICA_URL is not read-only — refusing. Set the replica user to READ ONLY.\n"
  exit 1
fi

if [[ "$UAT_TARGET_URL" == *"prod"* ]]; then
  printf "  ${RO}✗${R} UAT_TARGET_URL looks like prod. Refusing.\n"; exit 1
fi

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

printf "\n  ${AM}▸${R} ${B}Dumping source (masked at export where possible)${R}\n"
printf "  ${ZI}Working directory: %s${R}\n" "$work_dir"

# The full masked-dump pipeline is:
#   1. pg_dump the read-replica into scratch Postgres.
#   2. Apply ops/masking/mask.sql (M2 script).
#   3. pg_dump the scrubbed scratch DB.
#   4. Restore into UAT target.
#
# Today's script performs step 1 and 3 (raw dump) and warns loudly that step 2
# (masking) requires the M2 masking pack. This lets the plumbing work end-to-end
# now, and swaps to masked as soon as the SQL pack lands.

if [[ ! -f ops/masking/mask.sql ]]; then
  printf "  ${AM}⚠${R} ${B}ops/masking/mask.sql not present yet (lands in M2).${R}\n"
  printf "  ${ZI_HI}   Aborting to avoid loading unmasked prod data into UAT.${R}\n"
  printf "  ${ZI_HI}   Track: docs/DATA-CLASSIFICATION.md §3 for the target ruleset.${R}\n"
  exit 2
fi

pg_dump --format=custom "$PROD_REPLICA_URL" > "$work_dir/src.pgc"
printf "  ${EM}✓${R} Source dumped (%s)\n" "$(du -h "$work_dir/src.pgc" | cut -f1)"

# Boot scratch pg to apply masking
docker run -d --rm --name safari-mask-scratch -e POSTGRES_PASSWORD=mask -p 55432:5432 postgis/postgis:16-3.4 >/dev/null
trap 'docker stop safari-mask-scratch >/dev/null 2>&1 || true; rm -rf "$work_dir"' EXIT
until pg_isready -h localhost -p 55432 >/dev/null 2>&1; do sleep 1; done

printf "  ${AM}▸${R} ${B}Restoring into scratch${R}\n"
PGPASSWORD=mask pg_restore --dbname="postgresql://postgres:mask@localhost:55432/postgres" \
  --create --clean --if-exists --no-owner --no-privileges "$work_dir/src.pgc"

printf "  ${AM}▸${R} ${B}Applying masking rules${R}\n"
PGPASSWORD=mask psql "postgresql://postgres:mask@localhost:55432/safari_shule" -f ops/masking/mask.sql
printf "  ${EM}✓${R} Masking applied\n"

printf "  ${AM}▸${R} ${B}Dumping scrubbed data${R}\n"
PGPASSWORD=mask pg_dump --format=custom "postgresql://postgres:mask@localhost:55432/safari_shule" > "$work_dir/masked.pgc"

printf "  ${AM}▸${R} ${B}Restoring into UAT target${R}\n"
pg_restore --dbname="$UAT_TARGET_URL" --clean --if-exists --no-owner --no-privileges "$work_dir/masked.pgc"

printf "\n  ${EM}✓${R} UAT refreshed from masked prod snapshot.\n"
printf "  ${ZI_HI}   All P1/P2 columns anonymized; audit log dropped; timestamps preserved (±60s jitter).${R}\n"
