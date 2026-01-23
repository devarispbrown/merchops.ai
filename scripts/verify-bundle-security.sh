#!/bin/bash
#
# Bundle Security Verification Script
#
# Scans the Next.js production build for accidentally exposed secrets.
# This script should run in CI/CD pipeline before deployment.
#
# Usage: ./scripts/verify-bundle-security.sh
#
# Exit codes:
#   0 - No secrets found (safe to deploy)
#   1 - Secrets detected (block deployment)
#

set -e

echo "========================================="
echo "Bundle Security Verification"
echo "========================================="
echo ""

# Check if build directory exists
BUNDLE_DIR=".next"

if [ ! -d "$BUNDLE_DIR" ]; then
  echo "⚠️  Warning: Build directory not found. Run 'pnpm build' first."
  echo "Skipping verification (assuming pre-build check)"
  exit 0
fi

echo "Scanning bundle directory: $BUNDLE_DIR"
echo ""

# Patterns to detect (common secret patterns)
declare -a PATTERNS=(
  "SHOPIFY_API_SECRET"
  "SHOPIFY_CLIENT_SECRET"
  "DATABASE_URL"
  "ENCRYPTION_KEY"
  "NEXTAUTH_SECRET"
  "WEBHOOK_SECRET"
  "REDIS_URL"
  "EMAIL_PROVIDER_API_KEY"
  "OPENAI_API_KEY"
  "ANTHROPIC_API_KEY"
  "sk_live_[a-zA-Z0-9]{24}"    # Stripe live secret key
  "sk_test_[a-zA-Z0-9]{24}"    # Stripe test secret key
  "xoxb-[0-9]+-[0-9]+"         # Slack bot token
  "ghp_[a-zA-Z0-9]{36}"        # GitHub personal access token
  "postgres://.*:.*@"          # PostgreSQL connection string with password
)

FOUND=0
FINDINGS=()

echo "Scanning for secret patterns..."

for pattern in "${PATTERNS[@]}"; do
  # Search in static bundles (exclude source maps for performance)
  if grep -r -E "$pattern" "$BUNDLE_DIR/static" 2>/dev/null | grep -v ".map" > /dev/null; then
    echo "❌ Found secret pattern: $pattern"
    FINDINGS+=("$pattern")
    FOUND=1
  fi
done

echo ""

if [ $FOUND -eq 1 ]; then
  echo "========================================="
  echo "❌ SECURITY ERROR: Secrets Detected"
  echo "========================================="
  echo ""
  echo "The following secret patterns were found in the client bundle:"
  for finding in "${FINDINGS[@]}"; do
    echo "  - $finding"
  done
  echo ""
  echo "Action required:"
  echo "1. Remove NEXT_PUBLIC_ prefix from sensitive environment variables"
  echo "2. Move secrets to server-only code (use 'server-only' package)"
  echo "3. Verify environment variable configuration in .env files"
  echo "4. Review /docs/security.md for best practices"
  echo ""
  exit 1
fi

# Check for NEXT_PUBLIC_ variables that might be secrets
echo "Checking for suspicious NEXT_PUBLIC_ variables..."

SUSPICIOUS_PUBLIC_VARS=$(grep -r "NEXT_PUBLIC_" "$BUNDLE_DIR/static" 2>/dev/null | \
  grep -E "(SECRET|KEY|PASSWORD|TOKEN|CREDENTIAL)" | \
  grep -v ".map" || true)

if [ -n "$SUSPICIOUS_PUBLIC_VARS" ]; then
  echo "⚠️  Warning: Found suspicious NEXT_PUBLIC_ variable names:"
  echo "$SUSPICIOUS_PUBLIC_VARS" | head -5
  echo ""
  echo "Review these variables to ensure they don't contain sensitive data."
  echo ""
fi

# Success
echo "========================================="
echo "✅ Bundle Security Check Passed"
echo "========================================="
echo ""
echo "No secrets detected in client bundle."
echo "Build is safe to deploy."
echo ""

exit 0
