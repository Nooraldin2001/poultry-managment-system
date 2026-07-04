#!/usr/bin/env bash
# fix_production_allowed_hosts.sh — ensure tenant subdomains are allowed by Django.
#
# Run ON THE VPS:
#   cd /var/www/poultryhero && bash scripts/fix_production_allowed_hosts.sh
#
# Safe: does not print secrets. Restarts backend after env/settings verification.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/poultryhero}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/backend}"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"
SERVICE_NAME="${SERVICE_NAME:-poultryhero-backend}"
BASE_DOMAIN="${BASE_DOMAIN:-poultryhero.solutions}"
TEST_SUB="${TEST_SUB:-firstview}"

export DJANGO_SETTINGS_MODULE=config.settings.production

echo "========== ALLOWED_HOSTS fix =========="

if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^DJANGO_ALLOWED_HOSTS=" "$ENV_FILE"; then
    if grep "^DJANGO_ALLOWED_HOSTS=" "$ENV_FILE" | grep -q "\.${BASE_DOMAIN}"; then
      echo "OK: .env already includes .${BASE_DOMAIN} in DJANGO_ALLOWED_HOSTS"
    else
      echo "Patching DJANGO_ALLOWED_HOSTS in $ENV_FILE to include .${BASE_DOMAIN}"
      cp -a "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
      sed -i "s/^DJANGO_ALLOWED_HOSTS=/DJANGO_ALLOWED_HOSTS=.${BASE_DOMAIN},/" "$ENV_FILE"
    fi
  else
    echo "Adding DJANGO_ALLOWED_HOSTS=.${BASE_DOMAIN},... to $ENV_FILE"
    echo "DJANGO_ALLOWED_HOSTS=.${BASE_DOMAIN},${BASE_DOMAIN},www.${BASE_DOMAIN},admin.${BASE_DOMAIN},153.92.5.195" >> "$ENV_FILE"
  fi
else
  echo "WARN: $ENV_FILE not found — production.py auto-appends .${BASE_DOMAIN} on deploy"
fi

echo "--- Django ALLOWED_HOSTS (via shell) ---"
cd "$BACKEND_DIR"
source "$APP_DIR/.venv/bin/activate"
python manage.py shell -c "from django.conf import settings; print('ALLOWED_HOSTS:', settings.ALLOWED_HOSTS)"

echo "--- Restart backend ---"
systemctl restart "$SERVICE_NAME"
sleep 2
systemctl is-active "$SERVICE_NAME"

echo "--- Probe via public HTTPS ---"
curl -s -w "\nHTTP %{http_code}\n" "https://${TEST_SUB}.${BASE_DOMAIN}/api/v1/health/" | head -5 || true
echo ""
echo "Expected JSON: {\"status\":\"ok\",\"service\":\"poultryhero-api\"}"
echo "If HTML Bad Request (400), run: git pull && bash scripts/deploy_vps.sh"
