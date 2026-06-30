# Poultry Hero — VPS Deployment Guide (Hostinger)

Prototype deployment on a Hostinger VPS using Nginx + Gunicorn + PostgreSQL.

> **Security — read first**
> - **Never** use the same value for the database password and `DJANGO_SECRET_KEY`.
> - Generate a **long random** Django secret key (command in step 11).
> - The real `backend/.env` is created **manually on the VPS** and is **never committed**.
> - Placeholders below — replace before/while deploying:
>   - `CHANGE_ME_STRONG_DATABASE_PASSWORD`
>   - `CHANGE_ME_GENERATED_DJANGO_SECRET_KEY`
>   - `CHANGE_ME_ADMIN_PASSWORD`

---

## 1. Confirmed deployment values

```text
VPS IP:          153.92.5.195
SSH:             ssh root@153.92.5.195
Repo:            https://github.com/Nooraldin2001/poultry-managment-system
Branch:          main
Domain:          poultryhero.solutions
App directory:   /var/www/poultryhero
Frontend folder: frontend/
Backend service: poultryhero-backend
Nginx site:      poultryhero
```

Subdomains: `www`, `admin`, `demo` (all → `153.92.5.195`).

---

## 2. Hostinger DNS records

Create these A records in the Hostinger DNS manager:

```text
@      A      153.92.5.195
www    A      153.92.5.195
admin  A      153.92.5.195
demo   A      153.92.5.195
*      A      153.92.5.195    (optional, for tenant subdomains later)
```

Notes:
- Start with **explicit** subdomains so Certbot (HTTP-01) can validate them.
- **Wildcard** tenant subdomains (`*.poultryhero.solutions`) require a DNS-01
  challenge with Certbot later; HTTP-01 cannot issue wildcard certs.

---

## 3. SSH into the VPS

```bash
ssh root@153.92.5.195
```

---

## 4. Install system packages

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl ufw nginx postgresql postgresql-contrib \
  python3 python3-venv python3-pip build-essential certbot python3-certbot-nginx
```

---

## 5. Install Node 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
corepack --version || true
corepack enable || true
```

If `corepack enable` fails, you can still use `corepack pnpm ...` directly
(the deploy script does exactly that).

> **pnpm version:** `frontend/package.json` pins `"packageManager": "pnpm@10.18.0"`,
> which runs on Node 20. Do **not** rely on corepack's default pnpm (11.x) — it
> requires Node ≥ 22.13 and will crash on Node 20 with
> `No such built-in module: node:sqlite`. If you upgrade to Node 22 LTS you may
> bump the pin, but Node 20 + pnpm 10 is the supported combo here.

---

## 6. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 7. Create the app user and folder

The app runs under a dedicated, unprivileged `poultryhero` user.

```bash
sudo adduser --system --group --home /var/www/poultryhero poultryhero
sudo usermod -aG www-data poultryhero
sudo mkdir -p /var/www/poultryhero
sudo chown -R poultryhero:www-data /var/www/poultryhero
```

---

## 8. Clone the repo

```bash
sudo -u poultryhero git clone https://github.com/Nooraldin2001/poultry-managment-system /var/www/poultryhero
cd /var/www/poultryhero
```

---

## 9. Create the Python virtualenv

```bash
sudo -u poultryhero python3 -m venv /var/www/poultryhero/.venv
sudo -u poultryhero /var/www/poultryhero/.venv/bin/pip install --upgrade pip
```

---

## 10. PostgreSQL setup

> Use a **strong** password — **different** from the Django secret key.

```bash
sudo -u postgres psql
```

In the `psql` shell:

```sql
CREATE DATABASE poultryhero;
CREATE USER poultryhero_user WITH PASSWORD 'CHANGE_ME_STRONG_DATABASE_PASSWORD';
ALTER ROLE poultryhero_user SET client_encoding TO 'utf8';
ALTER ROLE poultryhero_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE poultryhero_user SET timezone TO 'Asia/Dubai';
GRANT ALL PRIVILEGES ON DATABASE poultryhero TO poultryhero_user;
\q
```

PostgreSQL 15+ also needs schema-level grants:

```bash
sudo -u postgres psql -d poultryhero -c "GRANT ALL ON SCHEMA public TO poultryhero_user;"
```

---

## 11. Create the production env file

```bash
sudo -u poultryhero cp backend/.env.production.example backend/.env
sudo -u poultryhero nano backend/.env
```

Manually set (at minimum):
- `DJANGO_SECRET_KEY` → a generated random key (below)
- `DATABASE_URL` → with the **strong** DB password from step 10
- `DJANGO_DEBUG=False`

Generate a Django secret key (requires Django installed — run after the first
deploy, or generate one locally and paste it):

```bash
/var/www/poultryhero/.venv/bin/python - <<'PY'
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
PY
```

> If Django isn't installed yet, run the first deploy (step 14) first, then
> generate the key and edit `backend/.env`, or generate it on your local machine.

---

## 12. Install the systemd service

```bash
sudo cp deploy/systemd/poultryhero-backend.service /etc/systemd/system/poultryhero-backend.service
sudo systemctl daemon-reload
sudo systemctl enable poultryhero-backend
```

The unit runs Gunicorn as `poultryhero:www-data`, binds a socket at
`/run/poultryhero/gunicorn.sock` (via `RuntimeDirectory`), and reads
`backend/.env`.

---

## 13. Install the Nginx site

```bash
sudo cp deploy/nginx/poultryhero.conf /etc/nginx/sites-available/poultryhero
sudo ln -sf /etc/nginx/sites-available/poultryhero /etc/nginx/sites-enabled/poultryhero
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 14. First deployment

> **Prerequisite:** `backend/.env` **must already exist** (step 11). The script
> fails fast if it's missing — the systemd `EnvironmentFile` and Django both need
> it, and without it the service crash-loops with `Result: resources`.

`deploy_vps.sh` uses `sudo` to restart the service and reload Nginx, so run the
first deployment as **root**:

```bash
cd /var/www/poultryhero
bash scripts/deploy_vps.sh
sudo systemctl status poultryhero-backend --no-pager -l
```

What the script does: verify `backend/.env` exists (else abort), fetch/reset
`origin/main`, clean ignored artifacts while **preserving `.env`** (it backs up
and restores the env files around `git clean`), install backend prod deps,
`check` → `migrate` → `collectstatic` (production settings), restart the backend,
`pnpm install --frozen-lockfile` + `pnpm run build` the frontend, then `nginx -t`
+ reload. It **never** runs `makemigrations` and **never** deletes `backend/.env`.

---

## 15. Seed reference data (production-safe)

Production deployment itself only runs migrate + collectstatic (see
`scripts/deploy_vps.sh`); it **never** creates demo business data. The only
reference seeds that are safe on a real tenant carry no business data:

```bash
cd /var/www/poultryhero/backend
source /var/www/poultryhero/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production

python manage.py seed_plans
python manage.py seed_permissions
```

### Optional demo data for staging only

> ⚠️ **Do not run these commands on a real production tenant.** They create fake
> customers/suppliers/products/inventory/purchases and require the explicit
> `--confirm-demo-data` flag (they refuse to run and print a warning otherwise).

```bash
python manage.py seed_initial --demo --confirm-demo-data --superadmin admin@poultryhero.solutions --password CHANGE_ME_ADMIN_PASSWORD
python manage.py seed_product_foundation --company-subdomain demo --confirm-demo-data
python manage.py seed_customer_supplier_demo --company-subdomain demo --confirm-demo-data
python manage.py seed_inventory_demo --company-subdomain demo --confirm-demo-data
python manage.py seed_purchase_demo --company-subdomain demo --confirm-demo-data
```

> `seed_initial --demo` creates the demo tenant on subdomain **`primefresh`**.
> If you want the seeds attached to the `demo` subdomain instead, create that
> company first (Super Admin API / Django admin) and pass its subdomain.

### Removing demo data (data hygiene)

**Production deployment must not seed or display demo data.** To remove a demo
tenant that was created for a walkthrough, use the safe purge command (dry-run
first). It targets only a known demo tenant and never deletes reference seeds.

```bash
cd /var/www/poultryhero/backend
source /var/www/poultryhero/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py purge_demo_data --company-subdomain demo --dry-run
python manage.py purge_demo_data --company-subdomain demo --confirm-delete-demo-data
```

### Frontend production data mode

The production frontend build runs in **live-API mode** and shows clean empty
states (never demo data) until screens are wired to the backend:

* `frontend/.env.production` → `VITE_API_BASE=https://poultryhero.solutions/api`,
  `VITE_USE_MOCK_DATA=false` (see `frontend/.env.production.example`).
* `VITE_USE_MOCK_DATA` defaults to `false` and is force-disabled in any
  production build. `scripts/deploy_vps.sh` refuses to build with it set to `true`.
* Local development may opt into mock data via `frontend/.env.development`
  (`VITE_USE_MOCK_DATA=true`).

---

## 16. SSL with Certbot (after DNS resolves)

```bash
sudo certbot --nginx -d poultryhero.solutions -d www.poultryhero.solutions -d admin.poultryhero.solutions -d demo.poultryhero.solutions
sudo certbot renew --dry-run
```

Certbot edits `deploy`'s installed Nginx file to add the 443 server block and an
HTTP→HTTPS redirect.

---

## 17. Verify

```bash
curl -I https://poultryhero.solutions
curl -I https://www.poultryhero.solutions
curl -I https://admin.poultryhero.solutions
curl -I https://demo.poultryhero.solutions
curl -I https://poultryhero.solutions/api/v1/health/
```

Or from your local machine:

```bash
BASE_DOMAIN=poultryhero.solutions bash scripts/verify_production.sh
```

`/api/v1/health/` should return `{"status":"ok","service":"poultryhero-api"}`.

---

## 18. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Domain doesn't resolve | DNS not propagated — wait; check `dig poultryhero.solutions` |
| **502 Bad Gateway** | Gunicorn down or socket missing — `sudo systemctl status poultryhero-backend`, `journalctl -u poultryhero-backend -f` |
| Socket permission denied | Nginx (www-data) can't read the socket — ensure service `Group=www-data` and `RuntimeDirectoryMode=0750`; restart service |
| `backend/.env` missing | Copy from `.env.production.example` (step 11); the service won't start without it |
| Wrong `DATABASE_URL` | Check user/password/host/db; test `psql "postgres://poultryhero_user:...@localhost:5432/poultryhero"` |
| PG 15+ permission denied for schema | Run the `GRANT ALL ON SCHEMA public` command (step 10) |
| `DisallowedHost` | Add the host to `DJANGO_ALLOWED_HOSTS` in `backend/.env` |
| CSRF/CORS errors | Set `CSRF_TRUSTED_ORIGINS` and `CORS_ALLOWED_ORIGINS` (https origins) in `backend/.env` |
| Frontend blank page | Build missing/failed — check `frontend/dist` exists; rebuild via deploy script; check Nginx `root` path |
| API calls hit wrong host | Set `VITE_API_BASE` at build time (deploy script passes `https://poultryhero.solutions/api`) |
| `corepack` not found / disabled | Re-run `corepack enable`, or use `corepack pnpm ...` directly (the scripts do) |
| Certbot validation failed | DNS must point to the VPS and ports 80/443 open (`ufw`); re-run after DNS resolves |

Logs:

```bash
journalctl -u poultryhero-backend -f
sudo tail -f /var/log/nginx/error.log
```
