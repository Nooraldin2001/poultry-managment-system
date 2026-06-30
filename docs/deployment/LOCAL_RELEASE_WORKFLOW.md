# Poultry Hero — Local Release Workflow

One command from your local machine to **test → commit → push → deploy**.

## Prerequisites

- SSH access to the VPS: `ssh root@153.92.5.195` works (key-based recommended).
- Local toolchain: Python venv for `backend/`, Node 20 + `corepack` for `frontend/`.
- `origin` remote points at `https://github.com/Nooraldin2001/poultry-managment-system`.

## Command

```bash
REMOTE_USER=root REMOTE_HOST=153.92.5.195 REMOTE_APP_DIR=/var/www/poultryhero BRANCH=main \
  ./scripts/local_release_deploy.sh "Deploy prototype" --yes
```

Interactive (asks before deploying):

```bash
./scripts/local_release_deploy.sh "Deploy prototype"
```

## What it does

1. **Backend checks** — `python manage.py check` and `pytest` in `backend/`.
2. **Frontend checks** — `corepack pnpm run typecheck` and `corepack pnpm run build` in `frontend/`.
3. **Commit + push** — if there are changes, `git add -A`, commit with your
   message, and `git push origin main`. If there are no changes, it skips the
   commit but still offers to deploy.
4. **Deploy** — SSH to the VPS and run
   `cd /var/www/poultryhero && BRANCH=main bash scripts/deploy_vps.sh`.

If any local check fails, the script stops **before** committing or deploying.

## Production vs demo data

The deploy step runs **only** migrate + collectstatic + build + restart on the VPS.
It **never** seeds demo/business data. If you need sample data on a **local or
staging** tenant, run the demo seed commands manually — they all require
`--confirm-demo-data` and refuse to run without it:

```bash
python manage.py seed_product_foundation --company-subdomain demo --confirm-demo-data
python manage.py seed_customer_supplier_demo --company-subdomain demo --confirm-demo-data
python manage.py seed_inventory_demo --company-subdomain demo --confirm-demo-data
python manage.py seed_purchase_demo --company-subdomain demo --confirm-demo-data
```

> ⚠️ Do not run these on a real production tenant.

To remove a demo tenant later, use the safe purge command (dry-run first):

```bash
python manage.py purge_demo_data --company-subdomain demo --dry-run
python manage.py purge_demo_data --company-subdomain demo --confirm-delete-demo-data
```

## Frontend mock vs live mode

- **Local development** may use mock data: copy `frontend/.env.development.example`
  to `frontend/.env.development` (`VITE_USE_MOCK_DATA=true`) for a fully browsable
  UI without a backend.
- **Production must use live-API mode**: `VITE_USE_MOCK_DATA=false` (the default).
  Mock mode is force-disabled in production builds regardless of the flag.
- The release script exports `VITE_USE_MOCK_DATA=false` and **refuses** to build
  if it is set to `true`. Mock mode must never be enabled on a production deploy.
- `bash scripts/check_no_production_mock_data.sh` statically verifies no screen
  imports mock data directly and no deploy script seeds demo data or enables mock.

## Notes

- No secrets are passed on the command line; the VPS reads `backend/.env` locally.
- Defaults (`root` / `153.92.5.195` / `/var/www/poultryhero` / `main`) can be
  overridden via the env vars shown above.
- `--yes` skips the deploy confirmation prompt (useful for CI-like runs).
