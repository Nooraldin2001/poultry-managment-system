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

# --- 0. Require backend/.env ----------------------------------------------
# The systemd unit's EnvironmentFile and Django both need it. Fail loudly
# here instead of letting the service crash-loop with "Result: resources".
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  echo "ERROR: $BACKEND_DIR/.env is missing." >&2
  echo "       Create it before deploying (see docs/deployment/VPS_DEPLOYMENT_GUIDE.md):" >&2
  echo "         cp $BACKEND_DIR/.env.production.example $BACKEND_DIR/.env" >&2
  echo "       then fill in DJANGO_SECRET_KEY, DATABASE_URL, etc." >&2
  exit 1
fi

# Avoid git "dubious ownership" when run as a different user (e.g. root).
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

# --- 1. Sync code ----------------------------------------------------------
echo "==> Fetching origin/$BRANCH and resetting..."
git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
# Remove ignored build artifacts/caches. NOTE: `git clean -X` deletes ALL
# gitignored files, which INCLUDES .env (the `-e` excludes do NOT protect
# files under -X). So back up the env files, clean, then restore them.
_env_backup="$(mktemp -d)"
[[ -f "$BACKEND_DIR/.env" ]] && cp -a "$BACKEND_DIR/.env" "$_env_backup/backend.env"
[[ -f "$APP_DIR/.env" ]] && cp -a "$APP_DIR/.env" "$_env_backup/root.env"
git clean -fdX
if [[ -f "$_env_backup/backend.env" ]]; then
  mkdir -p "$BACKEND_DIR"
  cp -a "$_env_backup/backend.env" "$BACKEND_DIR/.env"
fi
[[ -f "$_env_backup/root.env" ]] && cp -a "$_env_backup/root.env" "$APP_DIR/.env"
rm -rf "$_env_backup"

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
