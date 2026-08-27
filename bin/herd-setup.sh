#!/usr/bin/env bash
#
# herd-setup.sh — Configure Laravel Herd for Safari Shule local development
#
# This script:
# 1. Verifies Laravel Herd is installed
# 2. Creates a symlink ~/Herd/safari-shule → ~/Projects/me/safari-shule
# 3. Generates mkcert TLS certificates for *.safari-shule.test
# 4. Updates Docker compose config to use the certificates
# 5. Prints connection instructions
#
# Usage:
#   ./bin/herd-setup.sh
#
# Prerequisites:
#   - Laravel Herd installed (https://herd.laravel.com)
#   - mkcert installed (brew install mkcert or see https://github.com/FiloSottile/mkcert)
#   - Docker running
#   - Current working directory is the repo root

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
HERD_ROOT="${HOME}/Herd"
HERD_LINK="${HERD_ROOT}/safari-shule"
DOMAIN="safari-shule.test"
CERT_DIR="${REPO_ROOT}/infra/certs"

# ─────────────────────────────────────────────────────────────────────────────

echo "🔍 Checking prerequisites…"

# Check for Herd
if ! command -v herd >/dev/null 2>&1; then
  echo "❌ Laravel Herd CLI not found."
  echo "   Install from: https://herd.laravel.com"
  echo "   macOS: brew install laravel/tap/herd"
  exit 1
fi

# Check for mkcert
if ! command -v mkcert >/dev/null 2>&1; then
  echo "❌ mkcert not found."
  echo "   Install from: https://github.com/FiloSottile/mkcert"
  echo "   macOS: brew install mkcert"
  exit 1
fi

# Check Docker
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker is not running. Start Docker and try again."
  exit 1
fi

echo "✅ All prerequisites met."
echo ""

# ─────────────────────────────────────────────────────────────────────────────

echo "📁 Setting up Herd symlink…"

# Create Herd directory if it doesn't exist
mkdir -p "$HERD_ROOT"

# Remove existing symlink if present
if [[ -L "$HERD_LINK" ]]; then
  rm "$HERD_LINK"
  echo "   Removed stale symlink: $HERD_LINK"
fi

# Create symlink (or fail if it's a real directory)
if [[ -e "$HERD_LINK" ]]; then
  echo "❌ $HERD_LINK exists but is not a symlink."
  echo "   Please move it or delete it manually and re-run this script."
  exit 1
fi

ln -s "$REPO_ROOT" "$HERD_LINK"
echo "✅ Created symlink: $HERD_LINK → $REPO_ROOT"
echo ""

# ─────────────────────────────────────────────────────────────────────────────

echo "🔐 Generating mkcert TLS certificates…"

# Create cert directory
mkdir -p "$CERT_DIR"

# Generate certificates for *.safari-shule.test and safari-shule.test
mkcert -cert-file "$CERT_DIR/safari-shule.test.crt" \
       -key-file "$CERT_DIR/safari-shule.test.key" \
       "*.safari-shule.test" \
       "safari-shule.test" \
       "localhost" \
       "127.0.0.1" \
       "::1"

echo "✅ TLS certificates generated:"
echo "   Cert: $CERT_DIR/safari-shule.test.crt"
echo "   Key:  $CERT_DIR/safari-shule.test.key"
echo ""

# ─────────────────────────────────────────────────────────────────────────────

echo "✨ Configuring environment…"

# Ensure .env exists
if [[ ! -f "${REPO_ROOT}/.env" ]]; then
  echo "   Creating .env from template…"
  cp "${REPO_ROOT}/.env.example" "${REPO_ROOT}/.env"
fi

# Update .env to use safari-shule.test domain
if grep -q "^APP_BASE_DOMAIN=safarishule.test" "${REPO_ROOT}/.env"; then
  sed -i '' "s/^APP_BASE_DOMAIN=safarishule.test/APP_BASE_DOMAIN=safari-shule.test/" "${REPO_ROOT}/.env"
  echo "   Updated APP_BASE_DOMAIN in .env"
fi

if grep -q "^WEB_PUBLIC_URL=http://localhost:5173" "${REPO_ROOT}/.env"; then
  sed -i '' "s|^WEB_PUBLIC_URL=http://localhost:5173|WEB_PUBLIC_URL=https://safari-shule.test|" "${REPO_ROOT}/.env"
  echo "   Updated WEB_PUBLIC_URL in .env"
fi

if grep -q "^API_PUBLIC_URL=http://localhost:3000" "${REPO_ROOT}/.env"; then
  sed -i '' "s|^API_PUBLIC_URL=http://localhost:3000|API_PUBLIC_URL=https://api.safari-shule.test|" "${REPO_ROOT}/.env"
  echo "   Updated API_PUBLIC_URL in .env"
fi

echo "✅ Environment configured."
echo ""

# ─────────────────────────────────────────────────────────────────────────────

echo "📋 Summary"
echo "=========================================="
echo ""
echo "✅ Herd setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the infrastructure:"
echo "   make infra"
echo ""
echo "2. In separate terminals, start the dev servers:"
echo "   make api-dev"
echo "   make web-dev"
echo ""
echo "3. Open your browser:"
echo "   https://safari-shule.test (web)"
echo "   https://api.safari-shule.test/v1 (API)"
echo ""
echo "4. Log in with default demo credentials:"
echo "   Email:    admin@safari-shule.test"
echo "   Password: ChangeMe!Now1"
echo ""
echo "💡 Tips:"
echo "  • Herd's dnsmasq resolves *.test to 127.0.0.1"
echo "  • TLS certificates are in: infra/certs/"
echo "  • Docker compose nginx proxies all requests"
echo "  • Run 'make down' to stop all services"
echo ""
