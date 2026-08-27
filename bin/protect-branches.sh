#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install from https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Authenticate first: gh auth login"
  exit 1
fi

REMOTE_URL=$(git remote get-url origin)
if [[ "$REMOTE_URL" =~ github.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]}"
else
  echo "Unable to determine owner/repo from origin remote: $REMOTE_URL"
  exit 1
fi

echo "Applying branch protection for $OWNER/$REPO main"

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$OWNER/$REPO/branches/main/protection" \
  -f required_status_checks.strict=true \
  -f required_status_checks.contexts[]='Lint, Typecheck, Build, Test' \
  -f required_status_checks.contexts[]='Analyze (javascript-typescript)' \
  -f required_status_checks.contexts[]='Dependency Review' \
  -f enforce_admins=true \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.require_code_owner_reviews=false \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f required_linear_history=true \
  -F restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f block_creations=false \
  -f required_conversation_resolution=true

echo "Branch protection applied successfully."
