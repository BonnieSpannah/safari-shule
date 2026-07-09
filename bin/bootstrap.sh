#!/usr/bin/env bash
# =============================================================================
#  Safari Shule · bootstrap
#  One command from clone to running stack.
#  Detects your OS, wires Herd on macOS, renders templates, writes .env,
#  installs deps, boots Docker, migrates + seeds. Fully idempotent.
# =============================================================================
set -euo pipefail

# ------------- meta -------------
readonly SS_VERSION="0.1.0"
readonly SS_TITLE="SAFARI SHULE"
readonly SS_TAGLINE="Multi-tenant school transport · Kenya"
readonly SS_STAGE="bootstrap"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

# ------------- terminal capabilities -------------
if [[ -t 1 && -z "${NO_COLOR:-}" ]] && command -v tput >/dev/null 2>&1 \
   && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  TTY=1
else
  TTY=0
fi

if [[ $TTY -eq 1 ]]; then
  R=$'\033[0m'; B=$'\033[1m'; D=$'\033[2m'; U=$'\033[4m'
  EM=$'\033[38;2;16;185;129m'          # emerald 500 — primary
  EM_HI=$'\033[38;2;52;211;153m'       # emerald 400
  EM_BG=$'\033[48;2;16;185;129m'
  AM=$'\033[38;2;245;158;11m'          # amber 500 — prompt / warn
  RO=$'\033[38;2;244;63;94m'           # rose 500 — error
  SK=$'\033[38;2;56;189;248m'          # sky 400 — info
  ZI=$'\033[38;2;113;113;122m'         # zinc 500 — dim
  ZI_HI=$'\033[38;2;161;161;170m'      # zinc 400
  WH=$'\033[38;2;250;250;250m'         # white
else
  R= B= D= U= EM= EM_HI= EM_BG= AM= RO= SK= ZI= ZI_HI= WH=
fi

# ------------- glyphs -------------
if locale charmap 2>/dev/null | grep -qi "utf"; then
  G_STEP="▸"; G_OK="✓"; G_WARN="⚠"; G_ERR="✗"; G_INFO="ℹ"; G_BULLET="•"; G_ARROW="→"
  G_BAR="█"
  SPINNER=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
else
  G_STEP=">"; G_OK="+"; G_WARN="!"; G_ERR="x"; G_INFO="i"; G_BULLET="*"; G_ARROW="->"
  G_BAR="|"
  SPINNER=("-" "\\" "|" "/")
fi

# ------------- print helpers -------------
banner() {
  printf "\n"
  printf "   ${EM}%s${R}\n" "╭──────────────────────────────────────────────────────╮"
  printf "   ${EM}│${R}                                                      ${EM}│${R}\n"
  printf "   ${EM}│${R}  ${EM}${G_BAR}${R}  ${B}${WH}%-49s${R}${EM}│${R}\n" "$SS_TITLE"
  printf "   ${EM}│${R}  ${EM}${G_BAR}${R}  ${ZI_HI}%-49s${R}${EM}│${R}\n" "$SS_TAGLINE"
  printf "   ${EM}│${R}  ${EM}${G_BAR}${R}  ${D}${ZI}%-49s${R}${EM}│${R}\n" ""
  printf "   ${EM}│${R}  ${EM}${G_BAR}${R}  ${D}${ZI}v%s · %s%*s${R}${EM}│${R}\n" \
    "$SS_VERSION" "$SS_STAGE" $((49 - 5 - ${#SS_VERSION} - ${#SS_STAGE})) ""
  printf "   ${EM}│${R}                                                      ${EM}│${R}\n"
  printf "   ${EM}%s${R}\n\n" "╰──────────────────────────────────────────────────────╯"
}

step()   { printf "\n  ${AM}${G_STEP}${R} ${B}${WH}%s${R}\n" "$*"; }
ok()     { printf "    ${EM}${G_OK}${R} %s\n" "$*"; }
warn()   { printf "    ${AM}${G_WARN}${R} %s\n" "$*"; }
err()    { printf "    ${RO}${G_ERR}${R} %s\n" "$*" >&2; }
info()   { printf "    ${SK}${G_INFO}${R} ${ZI_HI}%s${R}\n" "$*"; }
kv()     { printf "    ${D}${ZI}%-16s${R} %s\n" "$1" "$2"; }
divider(){ printf "    ${D}${ZI}%s${R}\n" "──────────────────────────────────────────────────────"; }

section_hero() {
  local label="$1"
  printf "\n   ${EM_HI}%s${R}\n" "╭──────────────────────────────────────────────────────╮"
  printf "   ${EM_HI}│${R}  ${B}${WH}%-51s${R}${EM_HI} │${R}\n" "$label"
  printf "   ${EM_HI}%s${R}\n\n" "╰──────────────────────────────────────────────────────╯"
}

# ------------- spinner -------------
run_spun() {
  # usage: run_spun "message" -- command args...
  local msg="$1"; shift
  [[ "$1" == "--" ]] && shift
  local logf; logf="$(mktemp)"
  local i=0
  if [[ $TTY -eq 1 ]]; then
    ( "$@" >"$logf" 2>&1 ) &
    local pid=$!
    printf "    ${EM}${SPINNER[0]}${R} ${ZI_HI}%s${R}" "$msg"
    while kill -0 "$pid" 2>/dev/null; do
      printf "\r    ${EM}%s${R} ${ZI_HI}%s${R}" "${SPINNER[$((i % ${#SPINNER[@]}))]}" "$msg"
      i=$((i + 1))
      sleep 0.08
    done
    wait "$pid"
    local ec=$?
    if [[ $ec -eq 0 ]]; then
      printf "\r    ${EM}${G_OK}${R} %-70s\n" "$msg"
      rm -f "$logf"
      return 0
    else
      printf "\r    ${RO}${G_ERR}${R} %s\n" "$msg"
      err "Command failed (exit $ec). Last 20 log lines:"
      sed 's/^/      /' <(tail -n 20 "$logf") >&2
      rm -f "$logf"
      return $ec
    fi
  else
    "$@" 2>&1
  fi
}

# ------------- interactive helpers -------------
ask() {
  # usage: value=$(ask "Question" "default")
  local prompt=$1 default=$2 answer
  if [[ ! -t 0 ]]; then echo "$default"; return; fi
  printf "    ${AM}?${R} ${B}%s${R} ${D}${ZI}[%s]${R}: " "$prompt" "$default" >&2
  read -r answer
  echo "${answer:-$default}"
}

ask_choice() {
  # usage: value=$(ask_choice "Question" "default" opt1 opt2 opt3)
  local prompt=$1 default=$2; shift 2
  local choices=("$@") answer
  local joined; joined=$(IFS=/; printf '%s' "${choices[*]}")
  if [[ ! -t 0 ]]; then echo "$default"; return; fi
  printf "    ${AM}?${R} ${B}%s${R} ${D}${ZI}[%s]${R} ${ZI}(%s)${R}: " "$prompt" "$default" "$joined" >&2
  read -r answer
  answer=${answer:-$default}
  local ok=0
  for c in "${choices[@]}"; do [[ "$c" == "$answer" ]] && ok=1; done
  if [[ $ok -eq 0 ]]; then
    warn "Invalid choice '$answer'. Using default '$default'." >&2
    answer=$default
  fi
  echo "$answer"
}

ask_yn() {
  local prompt=$1 default=$2 answer
  if [[ ! -t 0 ]]; then echo "$default"; return; fi
  printf "    ${AM}?${R} ${B}%s${R} ${D}${ZI}[%s]${R}: " "$prompt" "$default" >&2
  read -r answer
  answer=${answer:-$default}
  case "${answer,,}" in y|yes|true|1) echo "yes";; *) echo "no";; esac
}

# ------------- detect -------------
detect_os() {
  case "$(uname -s)" in
    Darwin) OS="macos"; OS_LABEL="macOS $(sw_vers -productVersion 2>/dev/null || echo '?') ($(uname -m))" ;;
    Linux)
      OS="linux"
      if grep -qi microsoft /proc/version 2>/dev/null; then OS="wsl"; fi
      OS_LABEL="$(uname -sr) ($(uname -m))"
      ;;
    *) OS="unknown"; OS_LABEL="$(uname -s)" ;;
  esac
}

check_prereq() {
  local label=$1 cmd=$2 install=$3
  if command -v "$cmd" >/dev/null 2>&1; then
    local ver
    case "$cmd" in
      docker)  ver=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',') ;;
      node)    ver=$(node --version 2>/dev/null | tr -d 'v') ;;
      pnpm)    ver=$(pnpm --version 2>/dev/null) ;;
      brew)    ver=$(brew --version 2>/dev/null | head -1 | awk '{print $2}') ;;
      herd)    ver=$(herd --version 2>/dev/null | head -1) ;;
      git)     ver=$(git --version 2>/dev/null | awk '{print $3}') ;;
      openssl) ver=$(openssl version 2>/dev/null | awk '{print $2}') ;;
      *)       ver="found" ;;
    esac
    ok "$label ${ZI}${ver}${R}"
    return 0
  else
    warn "$label ${D}${ZI}(not found)${R} ${ZI_HI}→ ${install}${R}"
    return 1
  fi
}

# ------------- config gathering -------------
gather_config() {
  step "Configuration"
  info "Press ${B}Enter${R}${ZI_HI} to accept each default. All choices land in ${U}.env${R}."
  printf "\n"

  CFG_ENV=$(ask_choice "Environment" "dev" "dev" "uat" "prod-preview")
  CFG_DOMAIN=$(ask "Base domain (drives API, web, tenant subdomains, mobile)" "safari-shule.test")
  CFG_MAIL=$(ask_choice "Email provider" "mailhog" "mailhog" "mailtrap" "smtp" "mock")
  CFG_SMS=$(ask_choice "SMS provider" "mock" "mock" "africas_talking" "twilio" "infobip")
  CFG_INTEG=$(ask_choice "Integrations mode" "mock" "mock" "live")
  CFG_LOG=$(ask_choice "Log level" "info" "debug" "info" "warn" "error")
  CFG_BULLBOARD=$(ask_yn "Enable queue dashboard (Bull Board at /admin/queues)" "yes")
  CFG_METRICS=$(ask_yn "Enable Prometheus + Grafana + GlitchTip" "yes")
  CFG_SEED=$(ask_yn "Seed Hillcrest demo tenant" "yes")

  # Environment-specific opinions
  case "$CFG_ENV" in
    dev)
      : # accept user selections
      ;;
    uat)
      # UAT gets Mailtrap by default + info logs + no mocks unless explicit
      if [[ "$CFG_MAIL" == "mailhog" ]]; then CFG_MAIL="mailtrap"; fi
      if [[ "$CFG_LOG" == "debug" ]];   then CFG_LOG="info";    fi
      warn "UAT is masked-only. Use ${U}make uat-refresh${R} to load the latest scrubbed prod snapshot."
      ;;
    prod-preview)
      # Prod-preview forces safest defaults
      CFG_INTEG="live"
      CFG_MAIL=$(ask_choice "Email provider (live)" "smtp" "smtp" "mailtrap")
      CFG_SMS=$(ask_choice "SMS provider (live)"   "africas_talking" "africas_talking" "twilio" "infobip")
      if [[ "$CFG_LOG" == "debug" ]]; then CFG_LOG="info"; fi
      warn "prod-preview points at live external providers. Confirm you have valid keys."
      ;;
  esac

  printf "\n"
  info "Summary:"
  kv "environment"      "$CFG_ENV"
  kv "domain"           "$CFG_DOMAIN"
  kv "email"            "$CFG_MAIL"
  kv "sms"              "$CFG_SMS"
  kv "integrations"     "$CFG_INTEG"
  kv "log level"        "$CFG_LOG"
  kv "queue dashboard"  "$CFG_BULLBOARD"
  kv "observability"    "$CFG_METRICS"
  kv "seed demo tenant" "$CFG_SEED"
}

# ------------- secrets -------------
gen_hex() { openssl rand -hex "$1"; }
gen_b64() { openssl rand -base64 "$1" | tr -d '=/+' | cut -c1-"$1"; }

generate_secrets() {
  step "Generating secrets"
  if [[ -f .env ]]; then
    warn "Existing ${U}.env${R} found."
    local answer; answer=$(ask_yn "Overwrite with a fresh generated .env" "no")
    if [[ "$answer" != "yes" ]]; then
      SECRETS_JWT_ACCESS=$(grep '^JWT_ACCESS_SECRET=' .env | cut -d= -f2- | tr -d '"')
      SECRETS_JWT_REFRESH=$(grep '^JWT_REFRESH_SECRET=' .env | cut -d= -f2- | tr -d '"')
      SECRETS_DEK=$(grep '^DATA_ENCRYPTION_KEY=' .env | cut -d= -f2- | tr -d '"')
      SECRETS_POSTGRES=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2- | tr -d '"')
      ok "Kept existing secrets"
      ENV_PRESERVED=1
      return
    fi
    cp .env ".env.backup.$(date +%Y%m%d%H%M%S)"
    ok "Backed up existing .env"
  fi
  SECRETS_JWT_ACCESS=$(gen_b64 48)
  SECRETS_JWT_REFRESH=$(gen_b64 48)
  SECRETS_DEK=$(gen_hex 32)
  SECRETS_POSTGRES=$(gen_b64 24)
  ok "JWT_ACCESS_SECRET   ${D}${ZI}(48 bytes)${R}"
  ok "JWT_REFRESH_SECRET  ${D}${ZI}(48 bytes)${R}"
  ok "DATA_ENCRYPTION_KEY ${D}${ZI}(32 bytes hex)${R}"
  ok "POSTGRES_PASSWORD   ${D}${ZI}(random)${R}"
  ENV_PRESERVED=0
}

write_env() {
  step "Writing .env"
  if [[ ${ENV_PRESERVED:-0} -eq 1 ]]; then
    info "Preserved — edit ${U}.env${R} directly to change values."
    return
  fi

  local api_public web_public
  api_public="https://api.$CFG_DOMAIN"
  web_public="https://$CFG_DOMAIN"
  if [[ "$OS" != "macos" ]]; then
    api_public="http://localhost:3000"
    web_public="http://localhost:5173"
  fi

  cat > .env <<EOF
# Generated by bin/bootstrap.sh at $(date -Iseconds) — safe to edit
# ---------------------------------------------------------------------------
# RUNTIME
# ---------------------------------------------------------------------------
NODE_ENV=$( [[ "$CFG_ENV" == "prod-preview" ]] && echo "production" || echo "development" )
APP_ENV=$CFG_ENV
API_PORT=3000
WEB_PORT=5173
APP_BASE_DOMAIN=$CFG_DOMAIN
API_PUBLIC_URL=$api_public
WEB_PUBLIC_URL=$web_public
INTEGRATIONS_MODE=$CFG_INTEG
LOG_LEVEL=$CFG_LOG
BULL_BOARD_ENABLED=$( [[ "$CFG_BULLBOARD" == "yes" ]] && echo "true" || echo "false" )
METRICS_ENABLED=$( [[ "$CFG_METRICS" == "yes" ]] && echo "true" || echo "false" )
DATA_MASKING=$( [[ "$CFG_ENV" == "uat" ]] && echo "true" || echo "false" )
DATA_ENCRYPTION_KEY=$SECRETS_DEK

# ---------------------------------------------------------------------------
# POSTGRES (direct + pgbouncer)
# ---------------------------------------------------------------------------
POSTGRES_USER=safari
POSTGRES_PASSWORD=$SECRETS_POSTGRES
POSTGRES_DB=safari_shule
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DIRECT_URL=postgresql://safari:${SECRETS_POSTGRES}@localhost:5432/safari_shule?schema=public
DATABASE_URL=postgresql://safari:${SECRETS_POSTGRES}@localhost:6432/safari_shule?schema=public&pgbouncer=true&connection_limit=20

# ---------------------------------------------------------------------------
# REDIS
# ---------------------------------------------------------------------------
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
JWT_ACCESS_SECRET=$SECRETS_JWT_ACCESS
JWT_REFRESH_SECRET=$SECRETS_JWT_REFRESH
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# ---------------------------------------------------------------------------
# EMAIL — provider = $CFG_MAIL
# ---------------------------------------------------------------------------
MAIL_PROVIDER=$CFG_MAIL
EOF

  case "$CFG_MAIL" in
    mailhog)
      cat >> .env <<EOF
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="Safari Shule <no-reply@$CFG_DOMAIN>"
EOF
      ;;
    mailtrap)
      cat >> .env <<EOF
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="Safari Shule <no-reply@$CFG_DOMAIN>"
# → Fill SMTP_USER + SMTP_PASSWORD from your Mailtrap inbox settings.
EOF
      ;;
    smtp)
      cat >> .env <<EOF
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="Safari Shule <no-reply@$CFG_DOMAIN>"
# → Fill SMTP_HOST + SMTP_USER + SMTP_PASSWORD for your production SMTP.
EOF
      ;;
    mock)
      cat >> .env <<EOF
SMTP_HOST=
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="Safari Shule <no-reply@$CFG_DOMAIN>"
EOF
      ;;
  esac

  cat >> .env <<EOF

# ---------------------------------------------------------------------------
# SMS — provider = $CFG_SMS  (SMS_PROVIDER selects among the blocks below)
# ---------------------------------------------------------------------------
SMS_PROVIDER=$CFG_SMS
AT_USERNAME=sandbox
AT_API_KEY=
AT_SENDER_ID=SAFARISHULE
AT_DLR_CALLBACK_URL=$api_public/v1/integrations/at/dlr

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

INFOBIP_BASE_URL=
INFOBIP_API_KEY=
INFOBIP_SENDER_ID=SAFARISHULE

# ---------------------------------------------------------------------------
# M-PESA (Daraja) — mocked when INTEGRATIONS_MODE=mock
# ---------------------------------------------------------------------------
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=174379
MPESA_PASSKEY=
MPESA_CALLBACK_URL=$api_public/v1/payments/mpesa/callback

# ---------------------------------------------------------------------------
# OBSERVABILITY
# ---------------------------------------------------------------------------
SENTRY_DSN_API=
SENTRY_DSN_WEB=
SENTRY_ENVIRONMENT=$CFG_ENV

# ---------------------------------------------------------------------------
# HARDWARE INGESTION
# ---------------------------------------------------------------------------
HARDWARE_HMAC_REPLAY_WINDOW_SECONDS=300
HARDWARE_THROTTLE_PER_MINUTE=60
EOF

  chmod 600 .env
  ok "Wrote ${U}.env${R} ${D}${ZI}(chmod 600, $(wc -l < .env) lines)${R}"
}

# ------------- Herd + nginx template -------------
wire_herd() {
  [[ "$OS" != "macos" ]] && return

  step "Wiring Laravel Herd"
  if ! command -v herd >/dev/null 2>&1; then
    warn "Herd not installed — using http://localhost:<port> instead of https://$CFG_DOMAIN"
    warn "Install with: ${U}brew install --cask herd${R}"
    return
  fi

  local park="$HOME/Herd/safari-shule"
  if [[ -L "$park" || -d "$park" ]]; then
    ok "Herd parking already exists at ${U}$park${R}"
  else
    ln -s "$REPO_ROOT" "$park"
    ok "Linked ${U}$park${R} → ${U}$REPO_ROOT${R}"
  fi

  # Herd secures the parked directory name as <name>.test — we rename via
  # `herd link` when the target base domain isn't the default parking name.
  if [[ "$CFG_DOMAIN" != "safari-shule.test" ]]; then
    warn "Custom domain ${U}$CFG_DOMAIN${R} — configure Herd's parked TLD manually if needed."
  fi

  if herd secure safari-shule >/dev/null 2>&1; then
    ok "Herd TLS enabled (${U}https://$CFG_DOMAIN${R})"
  else
    warn "Could not run ${U}herd secure${R} automatically — run it manually and re-open the browser."
  fi
}

render_nginx() {
  step "Rendering nginx template"
  local tpl="infra/nginx.conf.template"
  local out="infra/nginx.conf"
  if [[ ! -f "$tpl" ]]; then
    err "Missing $tpl"
    return 1
  fi
  local escaped
  escaped=$(printf '%s' "$CFG_DOMAIN" | sed 's/\./\\./g')
  sed -e "s|__APP_BASE_DOMAIN__|$CFG_DOMAIN|g" \
      -e "s|__APP_BASE_DOMAIN_REGEX__|$escaped|g" \
      "$tpl" > "$out"
  ok "Wrote ${U}$out${R} for ${U}$CFG_DOMAIN${R}"
}

# ------------- deps + docker -------------
install_deps() {
  step "Installing dependencies"
  if ! command -v pnpm >/dev/null 2>&1; then
    if command -v corepack >/dev/null 2>&1; then
      corepack enable >/dev/null 2>&1 || true
      corepack prepare pnpm@9.15.9 --activate >/dev/null 2>&1 || true
    fi
  fi
  run_spun "pnpm install" -- pnpm install --prefer-frozen-lockfile || \
    run_spun "pnpm install (no lock)" -- pnpm install
  run_spun "shared-types build" -- pnpm --filter @safari-shule/shared-types run build
}

bring_up() {
  step "Bringing up the stack"
  if ! docker info >/dev/null 2>&1; then
    err "Docker daemon isn't running. Start Docker Desktop and re-run."
    exit 1
  fi

  local profiles=""
  [[ "$CFG_METRICS" == "yes" ]] || profiles="$profiles --scale prometheus=0 --scale grafana=0 --scale glitchtip=0"

  run_spun "docker compose up (pulling + building)" -- \
    docker compose -f infra/docker-compose.yml --env-file .env up -d --build

  # Wait for healths (postgres + redis + api)
  local timeout=90 t=0
  printf "    ${EM}${SPINNER[0]}${R} ${ZI_HI}%s${R}" "waiting for healthchecks"
  while [[ $t -lt $timeout ]]; do
    local pg redis
    pg=$(docker inspect --format='{{.State.Health.Status}}' safari-postgres 2>/dev/null || echo "missing")
    redis=$(docker inspect --format='{{.State.Health.Status}}' safari-redis 2>/dev/null || echo "missing")
    if [[ "$pg" == "healthy" && "$redis" == "healthy" ]]; then
      printf "\r    ${EM}${G_OK}${R} %-70s\n" "postgres + redis healthy"
      break
    fi
    printf "\r    ${EM}%s${R} ${ZI_HI}waiting… postgres=%s redis=%s (%ds)${R}" \
      "${SPINNER[$((t % ${#SPINNER[@]}))]}" "$pg" "$redis" "$t"
    sleep 1
    t=$((t + 1))
  done
  if [[ $t -ge $timeout ]]; then
    printf "\n"
    err "Timed out waiting for postgres/redis. Run ${U}make logs${R} to inspect."
    exit 1
  fi
}

migrate_and_seed() {
  step "Migrating and seeding"
  run_spun "prisma migrate deploy" -- \
    docker compose -f infra/docker-compose.yml --env-file .env exec -T api pnpm prisma migrate deploy

  if [[ "$CFG_SEED" == "yes" && "$CFG_ENV" == "dev" ]]; then
    run_spun "seed Hillcrest demo tenant" -- \
      docker compose -f infra/docker-compose.yml --env-file .env exec -T api pnpm db:seed
  elif [[ "$CFG_ENV" == "uat" ]]; then
    info "Skipping seed — UAT loads masked prod snapshots. Run ${U}make uat-refresh${R} next."
  else
    info "Skipping seed (env=$CFG_ENV, seed=$CFG_SEED)."
  fi
}

# ------------- summary -------------
print_ready() {
  section_hero "Ready ${G_OK}"

  local scheme="https" host="$CFG_DOMAIN"
  if [[ "$OS" != "macos" || ! -f "$HOME/Herd/safari-shule" && ! -L "$HOME/Herd/safari-shule" ]]; then
    if ! command -v herd >/dev/null 2>&1; then
      scheme="http"; host="localhost"
    fi
  fi

  info "URLs"
  if [[ "$scheme" == "https" ]]; then
    kv "Web console"      "${B}https://$host${R}"
    kv "API (Swagger)"    "${B}https://api.$host/docs${R}"
    kv "Tenant subdomain" "${B}https://hillcrest.$host${R}"
    kv "Mailhog"          "${B}https://mailhog.$host${R} ${D}${ZI}(if Herd parked)${R}"
  else
    kv "Web console"      "${B}http://localhost:5173${R}"
    kv "API (Swagger)"    "${B}http://localhost:3000/docs${R}"
    kv "Mailhog"          "${B}http://localhost:8025${R}"
  fi
  [[ "$CFG_METRICS" == "yes" ]] && {
    kv "Prometheus"       "${B}http://localhost:9090${R}"
    kv "Grafana"          "${B}http://localhost:3001${R} ${D}${ZI}(admin/admin)${R}"
    kv "GlitchTip"        "${B}http://localhost:8001${R}"
  }
  [[ "$CFG_BULLBOARD" == "yes" ]] && kv "Queues (Bull Board)" "${B}${scheme}://api.${host}/admin/queues${R}"

  if [[ "$CFG_SEED" == "yes" && "$CFG_ENV" == "dev" ]]; then
    printf "\n"
    info "Demo credentials"
    kv "admin email"    "${B}admin@hillcrest.ac.ke${R}"
    kv "admin password" "${B}Demo!Password1${R}"
    kv "tenant slug"    "${B}hillcrest${R}"
    info "RFID device secrets were printed during seed — scroll up if needed."
  fi

  printf "\n"
  info "Next commands"
  kv "logs"        "make logs"
  kv "restart api" "make restart"
  kv "psql shell"  "make db-shell"
  kv "run tests"   "pnpm test"
  kv "reset all"   "make reset  ${D}${ZI}(destructive)${R}"

  printf "\n   ${D}${ZI}Docs live in ${U}/docs${R}${D}${ZI}. Start with ${U}docs/RUNBOOK.md${R}${D}${ZI} for the guided tour.${R}\n\n"
}

# ------------- main -------------
main() {
  clear || true
  banner

  step "Detecting environment"
  detect_os
  ok "$OS_LABEL"
  case "$OS" in
    macos)
      check_prereq "Homebrew"       brew    "brew install …"                  || true
      check_prereq "Docker"         docker  "brew install --cask docker"      || { err "Docker is required."; exit 1; }
      check_prereq "Node.js"        node    "brew install nvm && nvm install" || { err "Node is required."; exit 1; }
      check_prereq "pnpm"           pnpm    "corepack enable && corepack prepare pnpm@latest --activate" || true
      check_prereq "Git"            git     "brew install git"                 || true
      check_prereq "OpenSSL"        openssl "brew install openssl"             || true
      check_prereq "Laravel Herd"   herd    "brew install --cask herd (recommended)" || true
      ;;
    linux|wsl)
      check_prereq "Docker"         docker  "https://docs.docker.com/engine/install/" || { err "Docker is required."; exit 1; }
      check_prereq "Node.js"        node    "https://nodejs.org — install v20.11.0"   || { err "Node is required."; exit 1; }
      check_prereq "pnpm"           pnpm    "corepack enable && corepack prepare pnpm@latest --activate" || true
      check_prereq "Git"            git     "apt install git / dnf install git"       || true
      check_prereq "OpenSSL"        openssl "apt install openssl / dnf install openssl-tools" || true
      ;;
    *)
      err "Unsupported OS. Bootstrap supports macOS, Linux, and WSL."
      exit 1
      ;;
  esac

  gather_config
  generate_secrets
  write_env
  render_nginx
  wire_herd
  install_deps
  bring_up
  migrate_and_seed
  print_ready
}

main "$@"
