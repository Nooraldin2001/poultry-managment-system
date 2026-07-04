# Post-Deployment Smoke Test Report

- **Date (UTC):** 2026-07-02 11:00 UTC (credentialed pass)
- **Environment:** Production
- **Domains:** `https://poultryhero.solutions`, `https://admin.poultryhero.solutions`
- **Health URL:** `https://poultryhero.solutions/api/v1/health/`
- **Commit under test:** `dcdd536`
- **Tester:** Release owner (manual Super Admin login) + Cursor Agent (browser/API verification)

---

## Infrastructure (pre-credentialed — unchanged)

| Check | Result |
|---|---|
| URL health (main, admin, API) | **Pass** — HTTP 200 |
| VPS env (`DJANGO_DEBUG=False`, `ALLOWED_HOSTS`) | **Pass** |
| Mock safety (Linux script + bundle) | **Pass** |
| Public login pages | **Pass** |

---

## Part A — Super Admin credentialed test

| Step | Result | Notes |
|---|---|---|
| Super Admin login | **Pass** | Manual login; `poultry_hero_access_token` present |
| Dashboard loads | **Pass** | KPIs show `0`; quick actions visible |
| Companies list (real backend) | **Pass** | `GET /api/v1/admin/companies/` → `count: 0` |
| No demo companies | **Pass** | Empty list; no `primefresh` / demo tenants |
| Create company via UI wizard | **Fail** | Wizard shows success UI but **does not call API**; list remains empty |
| Company appears in list | **Fail** | Blocked by UI wizard + missing plans seed |
| Plan/status fields | **N/A** | No companies created |
| Analytics unavailable/empty | **Pass** | Charts show `لا توجد بيانات فعلية بعد`; no fake revenue |
| Logout / re-login session | **Partial Pass** | Token persisted across admin reload (session OK); full logout cycle not re-tested to preserve session |

### Super Admin API verification (authenticated)

| Endpoint | Status | Result |
|---|---|---|
| `GET /api/v1/auth/me/` | 200 | Super Admin user (`is_superuser: true`) |
| `GET /api/v1/admin/companies/` | 200 | Empty paginated list (real data) |
| `GET /api/v1/admin/plans/` | 200 | **Empty array `[]`** — plans not seeded |
| `POST /api/v1/admin/companies/` | 400 | `plan_code: ["Unknown or inactive plan."]` |

### Console / network (Super Admin)

- API calls target `https://poultryhero.solutions/api`
- No localhost or mock-data warnings observed
- No critical console crashes on dashboard/companies flows

**Super Admin classification:** Partial pass — auth and read paths work; **company provisioning blocked**.

---

## Part B — Tenant owner/admin test

| Step | Result | Notes |
|---|---|---|
| Tenant owner created | **Fail** | No company/admin user provisioned |
| Login at `https://poultryhero.solutions` | **Blocked** | Main domain serves Super Admin login screen |
| Tenant dashboard | **Blocked** | No tenant company exists |
| Empty states / no fake data | **Blocked** | |
| Navigation modules | **Blocked** | |
| Logout / invalid login | **Not tested** | Tenant session unavailable |

**Classification:** **Blocked** — depends on company + tenant user provisioning.

---

## Part C — Core ERP workflow

All steps **Blocked** — no tenant company or owner user exists.

Planned smoke data (not created):

- Product: `Fresh Chicken 1000g` / `CHK-1000`
- Customer: `Smoke Test Customer`
- Supplier: `Smoke Test Supplier`
- Purchase/sales/collection/quotation/expense/tax/reports flows

---

## Part D — Permission smoke test

**Blocked** — cannot create accountant/cashier users without tenant company.

---

## Part E — Print preview smoke test

**Blocked** — no transactional records.

---

## Part F — Mobile smoke test

| Screen | Result |
|---|---|
| Super Admin dashboard (390×844) | **Pass** | Layout stacks; RTL correct; bottom nav usable |
| Tenant in-app flows | **Blocked** | No tenant session |

---

## Part G — Server logs

Not captured live during this browser session. **Recommended:** run in VPS SSH during re-test after fixes:

```bash
journalctl -u poultryhero-backend -f
tail -f /var/log/nginx/error.log
```

No `500`/`502` observed from browser/API probes during credentialed pass.

---

## Confirmed release blockers

### Blocker 1 — Super Admin create-company wizard is UI-only (fake success)

`CreateCompanyWizard` in `frontend/src/app/App.tsx` sets `done=true` and shows toast on submit **without** calling `POST /api/v1/admin/companies/`. User sees “تم إنشاء الشركة بنجاح!” but no company is created.

**Severity:** Release blocker (misleading success + cannot onboard tenants).

### Blocker 2 — Production plans reference data not seeded

`GET /api/v1/admin/plans/` returns `[]`. Backend company creation returns `400` with `Unknown or inactive plan.`

**Severity:** Release blocker (cannot provision companies even via API).

**Required VPS action (non-demo):**

```bash
cd /var/www/poultryhero/backend
source /var/www/poultryhero/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py seed_plans
python manage.py seed_permissions
```

---

## Summary

| Area | Result |
|---|---|
| Super Admin auth | **Pass** |
| Super Admin read/dashboard | **Pass** |
| Super Admin company create | **Fail** |
| Tenant auth + ERP | **Blocked** |
| Permissions / print / full mobile | **Blocked** |
| Mock safety / URL health | **Pass** |

**Launch stance:** **NO-GO** until company provisioning works end-to-end and tenant smoke can run.

---

## Part H — Tenant subdomain login (2026-07-04)

| Step | Result | Notes |
|---|---|---|
| `https://firstview.poultryhero.solutions` loads Poultry Hero | **Pass** | After Nginx wildcard fix |
| Same-origin API base | **Pass** | `POST /api/v1/auth/login/` on tenant host |
| Login / health API | **Fail (pre-fix deploy)** | Django HTML **400**, not JSON |

### Exact 400 response body (captured)

**Request method:** `POST`  
**Request URL:** `https://firstview.poultryhero.solutions/api/v1/auth/login/` (same-origin)  
**Request payload keys:** `email`, `password`  
**Response status:** `400 Bad Request`  
**Response content-type:** `text/html` (Django error page, not DRF JSON)  
**Response body:**

```html
<!doctype html>
<html lang="en">
<head>
  <title>Bad Request (400)</title>
</head>
<body>
  <h1>Bad Request (400)</h1><p></p>
</body>
</html>
```

**Also observed on:** `GET https://firstview.poultryhero.solutions/api/v1/health/` (same HTML 400).

**Root cause:** Django `DisallowedHost` — production `ALLOWED_HOSTS` missing `.poultryhero.solutions`, so tenant subdomain API requests are rejected before auth runs.

**Fix in repo (pending VPS deploy):**

- `backend/config/settings/production.py` — auto-append `.poultryhero.solutions` to `ALLOWED_HOSTS`
- `scripts/fix_production_allowed_hosts.sh` — patch `.env` + restart backend
- Frontend/backend auth contract already uses `email` (`User.USERNAME_FIELD = "email"`)

**After deploy expected:**

- Health: `{"status":"ok","service":"poultryhero-api"}`
- Wrong password: JSON `401` with DRF detail
- Valid First View tenant: JSON `200` + JWT; `/api/v1/auth/me/` returns First View company context
