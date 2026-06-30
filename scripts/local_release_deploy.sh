#!/usr/bin/env bash
#
# local_release_deploy.sh — run LOCALLY to test, commit, push, and deploy.
#
# Usage:
#   ./scripts/local_release_deploy.sh "Deploy prototype"
#   ./scripts/local_release_deploy.sh "Deploy prototype" --yes
#
# Defaults (override via env):
#   REMOTE_USER=root REMOTE_HOST=153.92.5.195 REMOTE_APP_DIR=/var/www/poultryhero BRANCH=main
#
# Runs backend check+pytest and frontend typecheck+build, commits/pushes any
# changes, then SSHes to the VPS and runs scripts/deploy_vps.sh. No secrets are
# ever passed on the command line.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

COMMIT_MSG="${1:-}"
ASSUME_YES="no"
if [[ "${2:-}" == "--yes" || "${2:-}" == "-y" ]]; then
  ASSUME_YES="yes"
fi
if [[ -z "$COMMIT_MSG" ]]; then
  echo "Usage: $0 \"commit message\" [--yes]" >&2
  exit 1
fi

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-153.92.5.195}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/var/www/poultryhero}"
BRANCH="${BRANCH:-main}"

confirm() {
  [[ "$ASSUME_YES" == "yes" ]] && return 0
  read -r -p "$1 [y/N] " reply
  case "$reply" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

# --- 1. Local checks -------------------------------------------------------
echo "==> Backend: manage.py check + pytest"
( cd backend && python manage.py check && python -m pytest -q )

echo "==> Frontend: typecheck + build"
( cd frontend && corepack pnpm run typecheck && corepack pnpm run build )

# --- 2. Commit + push (only if there are changes) --------------------------
if [[ -n "$(git status --porcelain)" ]]; then
  echo "==> Changes detected. Committing..."
  git add -A
  git commit -m "$COMMIT_MSG"
  echo "==> Pushing to origin/$BRANCH..."
  git push origin "$BRANCH"
else
  echo "==> No changes to commit."
fi

# --- 3. Deploy on the VPS --------------------------------------------------
if confirm "Deploy to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_APP_DIR} (branch $BRANCH)?"; then
  echo "==> Deploying on VPS..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" \
    "cd ${REMOTE_APP_DIR} && BRANCH=${BRANCH} bash scripts/deploy_vps.sh"
  echo "==> Remote deploy finished."
else
  echo "==> Skipped remote deploy."
fi
