#!/usr/bin/env bash
# run_technical_verification.sh — safe production technical checks (no secrets printed).
# Run on VPS: cd /var/www/poultryhero && bash scripts/run_technical_verification.sh
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/poultryhero}"
BACKEND_DIR="$APP_DIR/backend"
VENV="$APP_DIR/.venv/bin/python"
export DJANGO_SETTINGS_MODULE=config.settings.production

echo "========== A) GIT =========="
cd "$APP_DIR"
git status -sb
git log --oneline -3
echo "(tracked .env check)"
git ls-files backend/.env .env 2>/dev/null || true

echo "========== B) ENV (safe flags only) =========="
grep -E 'ENVIRONMENT|DEBUG|DJANGO_DEBUG|ALLOWED_HOSTS|DJANGO_ALLOWED_HOSTS|ENABLE_DEMO_DATA' "$BACKEND_DIR/.env" || true

echo "========== C) SERVICES =========="
systemctl is-active poultryhero-backend nginx || true
systemctl status poultryhero-backend --no-pager -l | head -n 15 || true
nginx -t 2>&1 || true

echo "========== D) DJANGO =========="
cd "$BACKEND_DIR"
source "$APP_DIR/.venv/bin/activate"
python manage.py check
python manage.py makemigrations --check --dry-run 2>&1 || true
python manage.py showmigrations 2>&1 | tail -n 20

echo "========== E) REFERENCE DATA =========="
python manage.py seed_plans
python manage.py seed_permissions
python manage.py shell -c "from apps.subscriptions.models import Plan; print('Plans:', Plan.objects.count())"
python manage.py shell -c "from apps.permissions.models import PermissionCode, RolePermissionDefault; print('Permission codes:', PermissionCode.objects.count()); print('Role defaults:', RolePermissionDefault.objects.count())"

echo "========== F) MOCK SAFETY =========="
cd "$APP_DIR"
bash scripts/check_no_production_mock_data.sh
grep -R "seed_.*demo\|seed_initial --demo\|VITE_USE_MOCK_DATA=true" scripts deploy 2>/dev/null || true

echo "========== G) URL HEALTH (local curl) =========="
curl -sI https://poultryhero.solutions | head -n 1
curl -sI https://admin.poultryhero.solutions | head -n 1
curl -s https://poultryhero.solutions/api/v1/health/

echo "========== I) API SANITY =========="
curl -si https://poultryhero.solutions/api/v1/auth/me/ | head -n 1
curl -si https://poultryhero.solutions/api/v1/admin/companies/ | head -n 1

echo "========== J) LOGS (tail) =========="
journalctl -u poultryhero-backend -n 50 --no-pager 2>&1 | tail -n 30
tail -n 30 /var/log/nginx/error.log 2>/dev/null || true

echo "========== DONE =========="
