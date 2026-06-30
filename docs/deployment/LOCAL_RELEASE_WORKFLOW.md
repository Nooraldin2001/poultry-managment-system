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

## Notes

- No secrets are passed on the command line; the VPS reads `backend/.env` locally.
- Defaults (`root` / `153.92.5.195` / `/var/www/poultryhero` / `main`) can be
  overridden via the env vars shown above.
- `--yes` skips the deploy confirmation prompt (useful for CI-like runs).
