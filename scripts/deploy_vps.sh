#!/usr/bin/env bash
#
# deploy_vps.sh — run ON THE VPS from inside the app directory to deploy.
#
#   cd /var/www/poultryhero && BRANCH=main bash scripts/deploy_vps.sh
#
# Pulls origin/<BRANCH>, installs backend prod deps, migrates, collects static,
# restarts the backend service, builds the frontend, and reloads Nginx.
#
# It NEVER touches backend/.env, never runs `makemigrations`, and never commits.
set -euo pipefail

# --- Config (override via env) ---------------------------------------------
APP_DIR="${APP_DIR:-/var/www/poultryhero}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_DIR/frontend}"
VENV_DIR="${VENV_DIR:-$APP_DIR/.venv}"
SERVICE_NAME="${SERVICE_NAME:-poultryhero-backend}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
BRANCH="${BRANCH:-main}"
VITE_API_BASE="${VITE_API_BASE:-https://poultryhero.solutions/api}"
# manage.py defaults to local settings; force production for deploy commands.
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.production}"

PY="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

echo "==> Deploying Poultry Hero"
echo "    APP_DIR=$APP_DIR  BRANCH=$BRANCH  SETTINGS=$DJANGO_SETTINGS_MODULE"

cd "$APP_DIR"

# Avoid git "dubious ownership" when run as a different user (e.g. root).
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

# --- 1. Sync code ----------------------------------------------------------
echo "==> Fetching origin/$BRANCH and resetting..."
git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
# Remove ONLY ignored build artifacts/caches (keeps migrations & .env).
git clean -fdX -e ".env" -e "backend/.env"

# --- 2. Backend ------------------------------------------------------------
if [[ ! -x "$PY" ]]; then
  echo "==> Creating virtualenv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi
echo "==> Installing backend production requirements..."
"$PIP" install --upgrade pip
"$PIP" install -r "$BACKEND_DIR/requirements/production.txt"

echo "==> Django check / migrate / collectstatic..."
( cd "$BACKEND_DIR" && "$PY" manage.py check )
( cd "$BACKEND_DIR" && "$PY" manage.py migrate --noinput )
( cd "$BACKEND_DIR" && "$PY" manage.py collectstatic --noinput )

echo "==> Restarting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

# --- 3. Frontend -----------------------------------------------------------
echo "==> Building frontend (VITE_API_BASE=$VITE_API_BASE)..."
(
  cd "$FRONTEND_DIR"
  export VITE_API_BASE
  corepack pnpm install --frozen-lockfile
  corepack pnpm run build
)

# --- 4. Nginx --------------------------------------------------------------
echo "==> Testing and reloading Nginx..."
sudo nginx -t
sudo systemctl reload "$NGINX_SERVICE"

echo
echo "==> Deploy complete. Verify:"
echo "    https://poultryhero.solutions"
echo "    https://admin.poultryhero.solutions"
echo "    https://poultryhero.solutions/api/v1/health/"
