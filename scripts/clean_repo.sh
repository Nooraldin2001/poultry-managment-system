#!/usr/bin/env bash
#
# clean_repo.sh — safely remove git-ignored build artifacts/caches.
#
# Removes ONLY files ignored by .gitignore (git clean -fdX). Tracked files and
# untracked-but-unignored files are never touched. Example files are protected.
#
# Usage:
#   bash scripts/clean_repo.sh          # interactive (asks for confirmation)
#   bash scripts/clean_repo.sh --yes    # non-interactive
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

ASSUME_YES="no"
if [[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]]; then
  ASSUME_YES="yes"
fi

# Never remove these even if a future pattern would ignore them.
PROTECT=(-e ".env.example" -e ".env.production.example")

echo "==> Current working tree (git status --short):"
git status --short || true
echo

echo "==> Dry run — ignored files that WOULD be removed (git clean -fdX -n):"
git clean -fdX -n "${PROTECT[@]}"
echo

if [[ "$ASSUME_YES" != "yes" ]]; then
  read -r -p "Proceed to remove the ignored files listed above? [y/N] " reply
  case "$reply" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted. Nothing was removed."; exit 0 ;;
  esac
fi

echo "==> Removing ignored files (git clean -fdX)..."
git clean -fdX "${PROTECT[@]}"
echo

echo "==> Final working tree (git status --short):"
git status --short || true
echo "Done."
