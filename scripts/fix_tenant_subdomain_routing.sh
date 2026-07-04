#!/usr/bin/env bash
# fix_tenant_subdomain_routing.sh — fix tenant *.poultryhero.solutions serving wrong app (BizManager Pro).
#
# Run ON THE VPS as root:
#   cd /var/www/poultryhero && bash scripts/fix_tenant_subdomain_routing.sh
#
# Safe: diagnoses first, backs up nginx configs, does not touch .env secrets.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/poultryhero}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/poultryhero.conf}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled/poultryhero.conf}"
POULTRY_ROOT="${POULTRY_ROOT:-/var/www/poultryhero/frontend/dist}"
VPS_IP="${VPS_IP:-153.92.5.195}"
BASE_DOMAIN="${BASE_DOMAIN:-poultryhero.solutions}"
TEST_SUBDOMAIN="${TEST_SUBDOMAIN:-firstview}"

echo "========== A) DIAGNOSE =========="
echo "--- DNS ---"
dig +short "${TEST_SUBDOMAIN}.${BASE_DOMAIN}" || true

echo "--- Enabled Nginx sites ---"
ls -lah /etc/nginx/sites-enabled/ || true

echo "--- Server blocks (server_name / root / listen 443) ---"
nginx -T 2>/dev/null | grep -E "^\s*(server_name|root |listen .*443|ssl_certificate)" | head -80 || true

echo "--- BizManager Pro references ---"
grep -R "Biz Manager Pro\|Business Management System\|index-Df09HOMO" -n /etc/nginx /var/www 2>/dev/null | head -30 || true

echo "--- Default SSL server (first listen 443 ssl) ---"
nginx -T 2>/dev/null | awk '/listen .*443 ssl/{p=1} p&&/server_name/{print; exit}' || true

echo "--- Compare content sizes ---"
curl -s -k -o /dev/null -w "admin: %{http_code} size=%{size_download}\n" "https://admin.${BASE_DOMAIN}/" || true
curl -s -k -o /dev/null -w "${TEST_SUBDOMAIN}: %{http_code} size=%{size_download}\n" "https://${TEST_SUBDOMAIN}.${BASE_DOMAIN}/" || true

echo "========== B) DISABLE OLD CONFLICTING SITES =========="
BACKUP_DIR="/root/nginx-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -a /etc/nginx/sites-available "$BACKUP_DIR/" 2>/dev/null || true
cp -a /etc/nginx/sites-enabled "$BACKUP_DIR/" 2>/dev/null || true

for f in /etc/nginx/sites-enabled/*; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f")"
  [[ "$base" == "poultryhero.conf" ]] && continue
  if grep -qiE "bizmanager|biz.manager|Business Management|index-Df09HOMO" "$f" 2>/dev/null; then
    echo "Disabling conflicting site: $base"
    rm -f "/etc/nginx/sites-enabled/$base"
  fi
done

# Disable default site if it serves non-poultry content
if [[ -L /etc/nginx/sites-enabled/default ]] || [[ -f /etc/nginx/sites-enabled/default ]]; then
  if grep -qiE "bizmanager|Business Management" /etc/nginx/sites-enabled/default 2>/dev/null; then
    echo "Disabling default site (BizManager catch-all)"
    rm -f /etc/nginx/sites-enabled/default
  fi
fi

echo "========== C) PATCH POULTRYHERO SSL SERVER_NAME =========="
if [[ ! -f "$NGINX_SITE" ]]; then
  echo "ERROR: $NGINX_SITE not found. Install from $APP_DIR/deploy/nginx/poultryhero.conf first." >&2
  exit 1
fi

cp -a "$NGINX_SITE" "${NGINX_SITE}.bak.$(date +%Y%m%d%H%M%S)"

# Ensure HTTP block includes wildcard (repo template)
if ! grep -q '\*\.poultryhero\.solutions' "$NGINX_SITE"; then
  sed -i 's/demo\.poultryhero\.solutions;/demo.poultryhero.solutions *.poultryhero.solutions;/g' "$NGINX_SITE" || true
fi

# Certbot adds a second server block on 443 — patch ALL poultryhero server_name lines
if grep -q 'listen.*443' "$NGINX_SITE"; then
  if ! grep -q '\*\.poultryhero\.solutions' "$NGINX_SITE"; then
    # Append wildcard to every explicit poultryhero server_name on 443 block vicinity
    perl -i -pe 's/(server_name\s+poultryhero\.solutions[^;]*);/$1 *.poultryhero.solutions;/ if $. > 1' "$NGINX_SITE" 2>/dev/null || \
    sed -i 's/admin\.poultryhero\.solutions;/admin.poultryhero.solutions *.poultryhero.solutions;/g' "$NGINX_SITE"
  fi
fi

# Ensure poultryhero root points to current frontend dist
if grep -q "root " "$NGINX_SITE"; then
  sed -i "s|root /var/www/[^;]*;|root ${POULTRY_ROOT};|g" "$NGINX_SITE" || true
fi

# Ensure proxy Host header on /api/
if ! grep -q 'X-Forwarded-Host' "$NGINX_SITE"; then
  sed -i '/proxy_set_header Host \$host;/a\        proxy_set_header X-Forwarded-Host $host;' "$NGINX_SITE" || true
fi

ln -sf "$NGINX_SITE" "$NGINX_ENABLED"

echo "========== D) SSL CERTIFICATE =========="
certbot certificates 2>/dev/null || true

echo ""
echo "Certificate must cover tenant subdomains. Choose ONE:"
echo "  1) Wildcard (recommended): certbot certonly --manual --preferred-challenges dns -d '${BASE_DOMAIN}' -d '*.${BASE_DOMAIN}'"
echo "  2) Single tenant (interim): certbot --nginx -d '${TEST_SUBDOMAIN}.${BASE_DOMAIN}' --expand"
echo ""
echo "If cert already includes *.${BASE_DOMAIN}, skip to reload."

if certbot certificates 2>/dev/null | grep -q "\*.${BASE_DOMAIN}"; then
  echo "Wildcard cert appears present."
elif certbot certificates 2>/dev/null | grep -q "${TEST_SUBDOMAIN}.${BASE_DOMAIN}"; then
  echo "Per-subdomain cert for ${TEST_SUBDOMAIN} appears present."
else
  echo "Attempting to expand cert for ${TEST_SUBDOMAIN}.${BASE_DOMAIN} (interim fix)..."
  certbot --nginx -d "${TEST_SUBDOMAIN}.${BASE_DOMAIN}" --non-interactive --agree-tos --expand 2>/dev/null || \
    echo "WARN: certbot expand failed — run wildcard DNS cert manually (see docs/deployment/TENANT_SUBDOMAIN_SETUP.md)"
fi

echo "========== E) TEST & RELOAD =========="
nginx -t
systemctl reload nginx

echo "--- Post-fix probe ---"
curl -s -k "https://${TEST_SUBDOMAIN}.${BASE_DOMAIN}/" | head -5
curl -s -k -o /dev/null -w "${TEST_SUBDOMAIN} title probe: " "https://${TEST_SUBDOMAIN}.${BASE_DOMAIN}/"
curl -s -k "https://${TEST_SUBDOMAIN}.${BASE_DOMAIN}/" | grep -i "<title>" || true
echo ""
curl -s -k "https://${TEST_SUBDOMAIN}.${BASE_DOMAIN}/api/v1/health/" || true
echo ""

echo "========== DONE =========="
echo "Expected title contains 'Poultry', NOT 'Business Management System'."
echo "If still wrong, inspect: nginx -T | grep -E 'server_name|root' -n"
