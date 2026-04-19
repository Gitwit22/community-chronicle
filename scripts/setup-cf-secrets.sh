#!/usr/bin/env bash
# setup-cf-secrets.sh
#
# Pushes sensitive environment variables as Cloudflare Pages secrets.
# These are NOT stored in wrangler.toml or committed to source control.
#
# Prerequisites:
#   - wrangler installed and authenticated (`wrangler login`)
#   - PROJECT_NAME set below (must match the `name` in wrangler.toml)
#
# Usage:
#   ./scripts/setup-cf-secrets.sh [environment]
#
# Examples:
#   ./scripts/setup-cf-secrets.sh production   # default
#   ./scripts/setup-cf-secrets.sh staging

set -euo pipefail

PROJECT_NAME="community-chronicle"
ENVIRONMENT="${1:-production}"

echo "Setting Cloudflare Pages secrets for project: $PROJECT_NAME (env: $ENVIRONMENT)"
echo "You will be prompted to enter the value for each secret."
echo ""

# ---------------------------------------------------------------------------
# Sensitive API tokens — these must never appear in wrangler.toml
# ---------------------------------------------------------------------------

echo "→ VITE_DOC_INTEL_API_TOKEN"
wrangler pages secret put VITE_DOC_INTEL_API_TOKEN \
  --project-name "$PROJECT_NAME" \
  --env "$ENVIRONMENT"

echo ""
echo "All secrets set successfully for [$ENVIRONMENT]."
echo ""
echo "To verify (names only, values are masked):"
echo "  wrangler pages secret list --project-name $PROJECT_NAME --env $ENVIRONMENT"
