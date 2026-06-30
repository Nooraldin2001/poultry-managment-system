#!/usr/bin/env bash
#
# verify_production.sh — smoke-check the deployed URLs with curl.
#
# Usage:
#   bash scripts/verify_production.sh
#   BASE_DOMAIN=poultryhero.solutions bash scripts/verify_production.sh
set -euo pipefail

BASE_DOMAIN="${BASE_DOMAIN:-poultryhero.solutions}"

URLS=(
  "https://${BASE_DOMAIN}"
  "https://www.${BASE_DOMAIN}"
  "https://admin.${BASE_DOMAIN}"
  "https://demo.${BASE_DOMAIN}"
  "https://${BASE_DOMAIN}/api/v1/health/"
)

echo "==> Verifying production endpoints for ${BASE_DOMAIN}"
fail=0
for url in "${URLS[@]}"; do
  echo
  echo "--- ${url}"
  if ! curl -sS -I --max-time 15 "$url"; then
    echo "!! request failed: ${url}"
    fail=1
  fi
done

echo
if [[ "$fail" -ne 0 ]]; then
  echo "==> One or more checks failed."
  exit 1
fi
echo "==> All checks completed."
