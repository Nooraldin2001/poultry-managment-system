# Technical Production Verification Report

- **Date (UTC):** 2026-07-02 11:35 UTC
- **Environment:** Production VPS (`153.92.5.195`)
- **App directory:** `/var/www/poultryhero`
- **Expected commit:** `dcdd536` (`main`)
- **Verifier:** Cursor Agent (remote curls + deploy log evidence; VPS SSH batch blocked)

---

## 1. Overall technical status

## **TECHNICAL GO WITH NOTES**

Infrastructure, services, URL health, API auth behavior, and frontend bundle safety are healthy based on deploy evidence and remote probes. **Reference data (plans/permissions) must be seeded on VPS before manual business smoke testing.** One migration-drift warning was observed during the latest deploy.

**Launch status:** `LAUNCH PENDING MANUAL SMOKE` (business workflows not tested in this pass).

---

## 2. Checks run

| Check | Method | Result |
|---|---|---|
| Git state | VPS deploy log + local repo | **Pass with note** |
| Env safety | Prior VPS SSH grep (safe flags) | **Pass with note** |
| systemd / Nginx | VPS deploy log (`nginx -t`, service restart) | **Pass** |
| Django check / migrations | VPS deploy log | **Pass with note** |
| Reference data (plans/permissions) | Prior credentialed API + deploy log (no seed step) | **Fail / action required** |
| Mock safety | Prior VPS script + repo script review | **Pass** |
| URL / SSL / health | Remote `curl` from automation host | **Pass** |
| Frontend bundle | Remote JS scan + VPS build log | **Pass** |
| API unauthenticated sanity | Remote `curl` | **Pass** |
| Logs | VPS deploy output (full journal not captured) | **Pass with note** |

**Note:** Non-interactive SSH (`BatchMode`) returned `Permission denied`. Full VPS command suite is available via active SSH session or `bash scripts/run_technical_verification.sh` on the server.

---

## 3. Results table

| Area | Status | Blocker? | Notes |
| --- | --- | ---: | --- |
| Git state | Pass (note) | No | Deploy reset to `origin/main`; local docs uncommitted only |
| Env safety | Pass (note) | No | `DJANGO_DEBUG=False`; hosts include production domains + IP |
| Backend service | Pass | No | Deploy restarted `poultryhero-backend`; health OK |
| Nginx | Pass (note) | No | `nginx -t` successful; minor protocol-options warning |
| Health endpoint | Pass | No | HTTP 200; `{"status":"ok","service":"poultryhero-api"}` |
| Migrations | Pass (note) | No | Applied; `company_settings` model drift warning (no new migrations) |
| Reference data | **Fail** | **Yes** | `GET /admin/plans/` returned `[]` earlier; deploy does not run `seed_plans` |
| Mock safety | Pass | No | VPS: `OK: no production mock-data hazards found.` |
| Frontend bundle | Pass | No | `VITE_USE_MOCK_DATA:"false"`; API base production; no `localhost:8000` |
| API sanity | Pass | No | Protected endpoints return `401`, not `500` |
| Logs | Pass (note) | No | No 500/502 in deploy output; full journal not tailed |

---

## Part A — Server and Git state

**Evidence (VPS deploy log, 2026-07-02 ~11:22 UTC):**

- Deploy fetched `origin/main`, ran `git reset --hard`, preserved `.env` via backup/restore
- Latest deploy completed successfully after frontend build + Nginx reload

**Local repo (for doc reference only):**

- HEAD: `dcdd536` — `productions ready`
- Untracked local docs only (smoke/launch reports); not deployed artifacts

**`.env` tracking:** Deploy script explicitly preserves `backend/.env` through `git clean`; `.env` must not be committed (standard pattern in `deploy_vps.sh`).

---

## Part B — Safe environment verification

**Prior VPS grep (secrets not printed):**

| Flag | Value | Result |
|---|---|---|
| `DJANGO_DEBUG` | `False` | Pass |
| `DJANGO_ALLOWED_HOSTS` | includes `poultryhero.solutions`, `www.poultryhero.solutions`, `admin.poultryhero.solutions`, `153.92.5.195` | Pass |
| `ENVIRONMENT=production` | not in grep | Note — `config.settings.production` used by systemd |
| `ENABLE_DEMO_DATA=False` | not in grep | Note — demo seeds require `--confirm-demo-data` |

**systemd unit:** `DJANGO_SETTINGS_MODULE=config.settings.production` (`deploy/systemd/poultryhero-backend.service`).

---

## Part C — System services

From latest deploy log:

- `systemctl restart poultryhero-backend` — completed
- `nginx -t` — **syntax ok**, test successful
- `systemctl reload nginx` — completed
- Warning: `protocol options redefined for [::]:443` (low priority)

---

## Part D — Backend health and Django checks

From deploy log:

```
System check identified no issues (0 silenced).
Running migrations: No migrations to apply.
```

**Migration drift warning:**

```
Your models in app(s): 'company_settings' have changes that are not yet reflected in a migration
```

- **Classification:** High-priority non-blocker for technical infra; address in next backend release before schema changes go live.

`makemigrations` was **not** run on production (correct).

---

## Part E — Reference data verification

**Status: FAIL — action required before manual smoke**

- Production deploy script runs `check`, `migrate`, `collectstatic` only — **does not** run `seed_plans` / `seed_permissions`
- Earlier credentialed API check: `GET /api/v1/admin/plans/` → `[]`
- Company creation API fails with `Unknown or inactive plan.` until plans exist

**Required VPS commands (safe, idempotent reference seeds):**

```bash
cd /var/www/poultryhero/backend
source /var/www/poultryhero/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py seed_plans
python manage.py seed_permissions
python manage.py shell -c "from apps.subscriptions.models import Plan; print('Plans:', Plan.objects.count())"
python manage.py shell -c "from apps.permissions.models import PermissionCode, RolePermissionDefault; print('Permission codes:', PermissionCode.objects.count()); print('Role defaults:', RolePermissionDefault.objects.count())"
```

---

## Part F — Production mock/demo safety

**VPS (prior session):**

```
OK: no production mock-data hazards found.
```

**Deploy scripts reviewed (`scripts/deploy_vps.sh`, `scripts/local_release_deploy.sh`):**

- No demo seed commands in production deploy path
- Refuses `VITE_USE_MOCK_DATA=true` with `ENVIRONMENT=production`
- Comments document demo seeds as manual/opt-in only

---

## Part G — URL, SSL, and API health

**Remote checks (2026-07-02 11:35 UTC):**

| URL | Result |
|---|---|
| `https://poultryhero.solutions` | HTTP 200 |
| `https://admin.poultryhero.solutions` | HTTP 200 |
| `https://poultryhero.solutions/api/v1/health/` | HTTP 200; body `{"status":"ok","service":"poultryhero-api"}` |

- No 502/504 observed
- HSTS headers present on API responses
- `certbot certificates` — not run (SSH batch blocked); TLS handshake succeeds from remote host

---

## Part H — Frontend build artifact verification

**VPS build log:**

- `VITE_API_BASE=https://poultryhero.solutions/api`
- `VITE_USE_MOCK_DATA=false`
- Output: `frontend/dist/assets/index-CNIEnP5B.js`

**Remote bundle scan:**

| Check | Result |
|---|---|
| `poultryhero.solutions/api` | Present |
| `localhost:8000` | Not found |
| `VITE_USE_MOCK_DATA:"false"` | Present |

Bundle size warning (~1.53 MB) — low-priority polish.

---

## Part I — API endpoint sanity (unauthenticated)

| Endpoint | HTTP | Expected |
|---|---|---|
| `/api/v1/auth/me/` | 401 | Pass |
| `/api/v1/admin/companies/` | 401 | Pass |
| `/api/v1/tenant/reports/dashboard/` | 401 | Pass |

No `500` responses on probed endpoints.

---

## Part J — Log review

**From deploy output:** No migration failures, no Gunicorn crash, Nginx reload succeeded.

**Not captured:** Full `journalctl -u poultryhero-backend -n 200` or nginx error tail in this pass (SSH batch blocked).

**Recommended in active SSH:**

```bash
journalctl -u poultryhero-backend -n 200 --no-pager
tail -n 200 /var/log/nginx/error.log
```

---

## Part K — Optional local build verification

Not run on production VPS (by design). Local repo at `dcdd536` previously passed `typecheck` and `build` during Phase 4B.

---

## 4. Remaining manual smoke items (release owner)

- Super Admin login
- Company creation (UI must call API — known gap)
- Tenant login
- Product / customer / supplier creation
- Purchase / sales approval
- Payment collection
- Quotation conversion
- Expense / tax / reports
- Permissions boundaries
- Print previews
- Mobile workflow

---

## 5. Blockers and non-blockers

### Technical blockers (before manual smoke)

1. **Reference data not seeded** — run `seed_plans` + `seed_permissions` on VPS

### High-priority non-blockers

1. `company_settings` migration drift warning on deploy
2. Super Admin create-company wizard not wired to API (business smoke item)
3. Full backend journal not reviewed in this pass

### Low-priority polish

1. Frontend bundle size warning
2. Nginx `protocol options redefined` warning
3. Optional `.env` documentation keys (`ENVIRONMENT`, `ENABLE_DEMO_DATA`)

---

## 6. Final recommendation

| Decision | Meaning |
|---|---|
| **TECHNICAL GO WITH NOTES** | Infra is up; health OK; auth/mocks/bundle safe |
| **LAUNCH PENDING MANUAL SMOKE** | Business workflows untested |
| **Action before manual smoke** | Run reference seeds on VPS; verify plan counts > 0 |

**VPS one-liner (after SSH login):**

```bash
cd /var/www/poultryhero && bash scripts/run_technical_verification.sh
```

(Script added at `scripts/run_technical_verification.sh` — safe checks only, runs reference seeds.)
