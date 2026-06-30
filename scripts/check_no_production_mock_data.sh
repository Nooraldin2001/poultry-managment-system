#!/usr/bin/env bash
#
# check_no_production_mock_data.sh — static data-hygiene guard (Phase 4A).
#
# Fails (exit 1) if it finds patterns that would let demo/mock data reach a
# production deployment:
#   1. Production screens importing mock data DIRECTLY (bypassing the gated
#      data/mock barrel or the service layer).
#   2. Deploy scripts that run demo seed commands.
#   3. Deploy scripts that export VITE_USE_MOCK_DATA=true.
#   4. The mock-mode config / data barrel missing their production gate.
#
# Run from the repo root:
#   bash scripts/check_no_production_mock_data.sh
set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0
fail() { echo "UNSAFE: $1" >&2; FAIL=1; }

FRONTEND_SRC="frontend/src"
DEPLOY_SCRIPTS=("scripts/deploy_vps.sh" "scripts/local_release_deploy.sh")

# --- 1. No production screen imports mock data directly --------------------
# Allowed: importing the gated barrel `@/data/mock` (no trailing slash) and the
# files INSIDE frontend/src/services/mock and frontend/src/data/mock themselves.
if [[ -d "$FRONTEND_SRC" ]]; then
  # Direct import of a specific mock data FILE (e.g. @/data/mock/company.mock)
  # from outside the data/mock and services/mock layers.
  hits="$(grep -rnE "from ['\"](@/data/mock/|\.\./.*data/mock/)" "$FRONTEND_SRC" \
            --include=*.ts --include=*.tsx \
            2>/dev/null \
          | grep -vE "$FRONTEND_SRC/(data/mock|services/mock)/" || true)"
  if [[ -n "$hits" ]]; then
    fail "screen(s) import a mock data file directly (use the service layer or gated barrel):"
    echo "$hits" >&2
  fi

  # Direct import of the mock service implementations from outside services/.
  hits="$(grep -rnE "from ['\"](@/services/mock|\.\./.*services/mock)" "$FRONTEND_SRC" \
            --include=*.ts --include=*.tsx \
            2>/dev/null \
          | grep -vE "$FRONTEND_SRC/services/" || true)"
  if [[ -n "$hits" ]]; then
    fail "screen(s) import services/mock directly (import from @/services instead):"
    echo "$hits" >&2
  fi
fi

# --- 2 & 3. Deploy scripts: no demo seeds, no mock flag on -----------------
SEED_PATTERNS='seed_initial[[:space:]]+--demo|seed_product_foundation|seed_customer_supplier_demo|seed_inventory_demo|seed_purchase_demo|--confirm-demo-data'
for f in "${DEPLOY_SCRIPTS[@]}"; do
  [[ -f "$f" ]] || continue
  # Drop comment lines before scanning so the data-hygiene comments don't trip.
  code="$(grep -vE '^[[:space:]]*#' "$f" || true)"
  if echo "$code" | grep -qE "$SEED_PATTERNS"; then
    fail "$f runs a demo seed command"
    echo "$code" | grep -nE "$SEED_PATTERNS" >&2 || true
  fi
  # Only an actual assignment/export of a truthy value (at statement start),
  # not echo messages or `== "true"` comparisons.
  mock_assign='^[[:space:]]*(export[[:space:]]+)?VITE_USE_MOCK_DATA=("?(true|1|yes)"?)([[:space:];]|$)'
  if echo "$code" | grep -qE "$mock_assign"; then
    fail "$f assigns/exports VITE_USE_MOCK_DATA=true"
    echo "$code" | grep -nE "$mock_assign" >&2 || true
  fi
done

# --- 4. Production gates must exist -----------------------------------------
CONFIG="$FRONTEND_SRC/services/config.ts"
if [[ -f "$CONFIG" ]]; then
  grep -q "IS_PRODUCTION" "$CONFIG" || fail "$CONFIG does not force mock off in production (no IS_PRODUCTION gate)"
else
  fail "missing $CONFIG (central mock-mode helper)"
fi

BARREL="$FRONTEND_SRC/data/mock/index.ts"
if [[ -f "$BARREL" ]]; then
  grep -q "IS_MOCK_MODE" "$BARREL" || fail "$BARREL does not gate demo data with IS_MOCK_MODE"
else
  fail "missing $BARREL (gated mock-data barrel)"
fi

if [[ "$FAIL" -eq 0 ]]; then
  echo "OK: no production mock-data hazards found."
fi
exit "$FAIL"
