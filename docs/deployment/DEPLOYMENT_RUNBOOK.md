# Poultry Hero — Deployment Runbook

Operational reference for an already-provisioned VPS. For first-time setup see
`VPS_DEPLOYMENT_GUIDE.md`.

```text
VPS:     ssh root@153.92.5.195
App dir: /var/www/poultryhero
Service: poultryhero-backend
Branch:  main
```

---

## Normal deployment

From your **local machine** (recommended — runs checks first):

```bash
REMOTE_USER=root REMOTE_HOST=153.92.5.195 REMOTE_APP_DIR=/var/www/poultryhero BRANCH=main \
  ./scripts/local_release_deploy.sh "Deploy prototype" --yes
```

Or directly **on the VPS**:

```bash
cd /var/www/poultryhero
BRANCH=main bash scripts/deploy_vps.sh
```

---

## Rollback basics

The deploy resets to `origin/main`, so roll back by pointing `main` at a known
good commit (or deploy a specific commit):

```bash
# On the VPS — deploy a previous, known-good commit:
cd /var/www/poultryhero
git fetch --prune origin main
git reset --hard <GOOD_COMMIT_SHA>
BRANCH=main bash scripts/deploy_vps.sh   # rebuilds + restarts from current checkout
```

Preferred long-term: revert the bad commit in Git (`git revert`), push, redeploy.

> Database migrations are **not** auto-rolled back. If a release added a
> migration, rolling back code may require a compatible DB state. Take a backup
> before risky migrations (see below).

---

## Logs

```bash
journalctl -u poultryhero-backend -f          # backend (Gunicorn/Django)
sudo tail -f /var/log/nginx/error.log         # Nginx errors
sudo tail -f /var/log/nginx/access.log        # Nginx access
```

---

## Restart / reload

```bash
sudo systemctl restart poultryhero-backend
sudo systemctl status poultryhero-backend --no-pager -l
sudo nginx -t && sudo systemctl reload nginx
```

---

## Update environment variables

```bash
sudo -u poultryhero nano /var/www/poultryhero/backend/.env
sudo systemctl restart poultryhero-backend
```

`backend/.env` is **never** committed and is **never** modified by the deploy
script. Changes take effect on restart.

---

## Re-run the deploy script

Idempotent — safe to re-run:

```bash
cd /var/www/poultryhero && BRANCH=main bash scripts/deploy_vps.sh
```

---

## Never run `makemigrations` on the server

Migrations are authored locally and committed. The server only applies them:

```bash
# WRONG on server:  python manage.py makemigrations
# RIGHT (the deploy script already does this):
cd /var/www/poultryhero/backend
DJANGO_SETTINGS_MODULE=config.settings.production \
  /var/www/poultryhero/.venv/bin/python manage.py migrate --noinput
```

If `migrate` reports missing migrations, fix it **locally**, commit, then deploy.

---

## Production deployment (what runs automatically)

The deploy (`scripts/deploy_vps.sh`) runs **only**:

1. `manage.py check`
2. `manage.py migrate --noinput`
3. `manage.py collectstatic --noinput`
4. build the frontend (`pnpm run build`)
5. restart the backend service + reload Nginx

It **never seeds demo/business data**. The only safe-to-run bootstrap commands on
a real tenant are the reference seeds (no business data):

```bash
python manage.py seed_plans
python manage.py seed_permissions
```

## Optional demo data for staging only

> ⚠️ **Do not run these commands on a real production tenant.** They create fake
> customers/suppliers/products/inventory/purchases. Every command below now
> **requires `--confirm-demo-data`** and prints a warning; without the flag it
> refuses to run.

```bash
cd /var/www/poultryhero/backend
source /var/www/poultryhero/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py seed_initial --demo --confirm-demo-data --superadmin admin@poultryhero.solutions --password CHANGE_ME_ADMIN_PASSWORD
python manage.py seed_product_foundation --company-subdomain demo --confirm-demo-data
python manage.py seed_customer_supplier_demo --company-subdomain demo --confirm-demo-data
python manage.py seed_inventory_demo --company-subdomain demo --confirm-demo-data
python manage.py seed_purchase_demo --company-subdomain demo --confirm-demo-data
```

> Run `seed_inventory_demo` **after** `seed_product_foundation`; run
> `seed_purchase_demo` after suppliers + products exist. All are idempotent.
> `seed_initial --demo` creates the `primefresh` tenant — adjust
> `--company-subdomain` to match an existing company.

## Removing demo data from a deployment

**Rule: production deployment must not seed or display demo data.** If a demo
tenant was ever created (e.g. for a walkthrough), remove it with the safe purge
command. Always dry-run first; it only ever targets a known demo tenant and never
deletes reference seeds (Plan / PermissionCode / RolePermissionDefault).

```bash
cd /var/www/poultryhero/backend
source /var/www/poultryhero/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py purge_demo_data --company-subdomain demo --dry-run
python manage.py purge_demo_data --company-subdomain demo --confirm-delete-demo-data
```

The frontend never shows demo data in a production build: `VITE_USE_MOCK_DATA`
defaults to `false` and is force-disabled in production builds. The deploy script
refuses to build with `VITE_USE_MOCK_DATA=true`.

**Frontend build env (Phase 1):** copy `frontend/.env.production.example` or pass at build time:

```bash
VITE_API_BASE=/api
VITE_USE_MOCK_DATA=false
```

The production bundle calls live JWT auth and dashboard APIs at `{VITE_API_BASE}/v1/...`.
Use same-origin `/api` so the same frontend build works on the root/admin hosts
and every tenant subdomain without embedding a tenant hostname.
See `docs/frontend/PHASE_1_API_INTEGRATION_NOTES.md`.

The deploy script rejects production builds where `VITE_API_BASE` points to a
tenant-specific `*.poultryhero.solutions` host. See
`docs/deployment/TENANT_DOMAIN_ISOLATION.md`.

---

## Backups (before going to production)

This is a **prototype** setup. Before real production use:

```bash
# Database dump:
sudo -u postgres pg_dump poultryhero > ~/poultryhero_$(date +%F).sql
# Media files:
sudo tar czf ~/poultryhero_media_$(date +%F).tar.gz -C /var/www/poultryhero/backend media
```

> ⚠️ There is no automated backup yet. Schedule `pg_dump` + media backups
> (and test restores) before storing real customer data.
