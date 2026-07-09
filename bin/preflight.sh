#!/usr/bin/env bash
# =============================================================================
#  Safari Shule · preflight
#  Quick "is my machine ready?" check. Prints what's missing. Changes nothing.
# =============================================================================
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  R=$'\033[0m'; B=$'\033[1m'; D=$'\033[2m'
  EM=$'\033[38;2;16;185;129m'
  AM=$'\033[38;2;245;158;11m'
  RO=$'\033[38;2;244;63;94m'
  ZI=$'\033[38;2;113;113;122m'
  ZI_HI=$'\033[38;2;161;161;170m'
else
  R= B= D= EM= AM= RO= ZI= ZI_HI=
fi

ok()   { printf "  ${EM}✓${R} %s\n" "$*"; }
warn() { printf "  ${AM}⚠${R} %s\n" "$*"; }
fail() { printf "  ${RO}✗${R} %s\n" "$*"; }

check() {
  local name=$1 cmd=$2 hint=$3
  if command -v "$cmd" >/dev/null 2>&1; then
    local ver="found"
    case "$cmd" in
      docker)  ver=$(docker --version | awk '{print $3}' | tr -d ',') ;;
      node)    ver=$(node --version | tr -d 'v') ;;
      pnpm)    ver=$(pnpm --version) ;;
      brew)    ver=$(brew --version | head -1 | awk '{print $2}') ;;
      herd)    ver=$(herd --version | head -1) ;;
      git)     ver=$(git --version | awk '{print $3}') ;;
      openssl) ver=$(openssl version | awk '{print $2}') ;;
    esac
    ok "$name ${ZI}${ver}${R}"
    return 0
  else
    fail "$name ${D}${ZI}(missing)${R} — $hint"
    return 1
  fi
}

printf "\n  ${B}Safari Shule · preflight${R}\n\n"

os=$(uname -s)
case "$os" in
  Darwin) ok "macOS $(sw_vers -productVersion) ($(uname -m))" ;;
  Linux)  ok "$(uname -sr) ($(uname -m))" ;;
  *)      warn "$os — unsupported OS" ;;
esac

fails=0

case "$os" in
  Darwin)
    check "Homebrew"     brew    "https://brew.sh"                                 || ((fails+=1))
    check "Docker"       docker  "brew install --cask docker"                     || ((fails+=1))
    check "Node.js"      node    "brew install nvm && nvm install 20.11.0"        || ((fails+=1))
    check "pnpm"         pnpm    "corepack enable && corepack prepare pnpm@latest --activate" || ((fails+=1))
    check "Git"          git     "brew install git"                                || ((fails+=1))
    check "OpenSSL"      openssl "brew install openssl"                            || ((fails+=1))
    check "Laravel Herd" herd    "brew install --cask herd  (optional but recommended)" || true
    ;;
  Linux)
    check "Docker"  docker  "https://docs.docker.com/engine/install/"   || ((fails+=1))
    check "Node.js" node    "https://nodejs.org — install v20.11.0"     || ((fails+=1))
    check "pnpm"    pnpm    "corepack enable && corepack prepare pnpm@latest --activate" || ((fails+=1))
    check "Git"     git     "apt install git"                            || ((fails+=1))
    check "OpenSSL" openssl "apt install openssl"                        || ((fails+=1))
    ;;
esac

if docker info >/dev/null 2>&1; then
  ok "Docker daemon running"
else
  fail "Docker daemon is not running — start Docker Desktop / systemd service"
  ((fails+=1))
fi

if [[ -f .env ]]; then
  ok ".env exists"
else
  warn ".env missing — run ${B}make bootstrap${R} to generate it"
fi

if [[ -f infra/nginx.conf ]]; then
  ok "infra/nginx.conf rendered"
else
  warn "infra/nginx.conf missing — ${B}make bootstrap${R} will render it from the template"
fi

printf "\n"
if [[ $fails -eq 0 ]]; then
  ok "Machine ready. Next: ${B}make bootstrap${R}"
  exit 0
else
  fail "$fails prerequisite(s) missing. Fix them, then re-run."
  exit 1
fi
