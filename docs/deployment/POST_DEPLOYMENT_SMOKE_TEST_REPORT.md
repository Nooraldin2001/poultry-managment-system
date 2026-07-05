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

---

## Part I — Tenant customer creation (2026-07-04)

| Step | Result | Notes |
|---|---|---|
| Add Customer form submits | **Fail (pre-fix)** | UI-only toast; **no POST** sent |
| Customer appears in list | **Fail (pre-fix)** | Nothing persisted |
| Visible error on failure | **Fail (pre-fix)** | Fake success toast |

### Root cause (code)

`CreateCustomerScreen` in `frontend/src/app/CustomerModule.tsx` called `toast.success()` and navigated back **without** calling `createCustomer()` / `POST /api/v1/tenant/customers/`.

Live service layer existed (`customerService.createCustomer`, `buildCustomerCreatePayload`) but was **never wired** from the UI — same pattern as the old company wizard fake success.

### Fix in repo

- Wire `handleSave` → `createCustomer(buildCustomerCreatePayload(...))`
- Loading/disabled submit, `FormErrors` for DRF validation, permission denied for cashier
- Expanded payload mapper (`name_ar`, `phone`, optional fields, opening balance enums)
- Load customer categories from `GET /api/v1/tenant/customer-categories/` when available (category optional)
- List refreshes on return (screen remount refetches `GET /api/v1/tenant/customers/`)

### After deploy expected

- `POST /api/v1/tenant/customers/` → **201** with real customer JSON
- New customer visible in list immediately and after browser refresh
- Validation errors shown on form (missing `name_ar` / `phone`)

---

## Part J — Reports demo data + First View cleanup (2026-07-04)

| Step | Result | Notes |
|---|---|---|
| Reports show fake names (مطعم الخليج, WESTLAND, etc.) | **Fail (pre-fix)** | Hardcoded `R_*` sample arrays rendered even when `IS_MOCK_MODE=false` |
| Reports use live API only | **Fixed in code** | `ReportsModule.tsx`, `PaymentsModule.tsx`, tenant dashboard sections |
| DB demo data purge dry-run | **Not run** | Requires VPS SSH (`purge_tenant_demo_data --company-subdomain firstview --dry-run`) |
| DB demo data purge confirm | **Not run** | Pending dry-run review |

### Root cause — reports demo data

**Frontend mock fallback**, not primary DB seed data. `ReportsModule.tsx` fetched live KPI totals from the API but **always rendered** hardcoded sample arrays (`R_SALES_INVOICES`, `R_CUSTOMERS`, `R_SALES_TREND`, etc.) for charts and tables. Tenant dashboard sections in `App.tsx` also listed `T_INVOICES`, `T_CUSTOMERS`, `T_SUPPLIERS`, `T_PRODUCTS` without `IS_MOCK_MODE` guards.

### Fix in repo

| File | Change |
|------|--------|
| `frontend/src/features/reports/reportLiveData.ts` | `liveOrMockRows`, `liveOrMockChart`, mappers, `EMPTY_REPORT_MSG` |
| `frontend/src/app/ReportsModule.tsx` | Sales/purchase/tax/profit/inventory use API `records`/`breakdowns`; mock samples only when `IS_MOCK_MODE`; empty panel in live mode |
| `frontend/src/app/PaymentsModule.tsx` | `PaymentsReportScreen` wired to `getPaymentsReport()` |
| `frontend/src/app/App.tsx` | Dashboard invoice/customer/supplier/inventory lists gated; zeros/empty states in live mode |

### Backend cleanup commands (added, not executed on prod)

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --dry-run
python manage.py purge_tenant_demo_data --company-subdomain firstview --confirm-delete-demo-data
python manage.py reset_tenant_operational_data --company-subdomain firstview --dry-run  # dangerous; only if tenant has no real ops data
```

### Local checks (2026-07-04)

| Check | Result |
|---|---|
| `corepack pnpm run typecheck` | **Pass** |
| `corepack pnpm run build` | **Pass** |
| `python manage.py check` | **Pass** |
| `pytest tests/test_customers.py tests/test_tenant_demo_commands.py tests/test_reports.py` | **50 passed** |
| `bash scripts/check_no_production_mock_data.sh` | **Pass** |

### After deploy — manual smoke (First View)

1. Login at `https://firstview.poultryhero.solutions`
2. Open Reports → verify zeros / “No real data yet”, not demo names
3. Add Customer → verify `POST 201`, row in list, persists after refresh
4. Run purge dry-run on VPS; confirm only demo-pattern rows before `--confirm-delete-demo-data`

**Launch stance:** **NO-GO** until deploy + manual First View ERP smoke passes.

---

## Part K — Production deploy + verification (2026-07-04 evening)

### Deploy status

| Item | Result | Notes |
|---|---|---|
| `git pull origin main` + `deploy_vps.sh` | **Pass** | VPS deploy completed (user SSH session); bundle `index-dMIyB4tH.js` built 2026-07-04 ~17:41 UTC |
| Deployed commit | **`ded78f1`** | Customer creation fix (`CreateCustomerScreen` → live POST) |
| Backend restart / Nginx reload | **Pass** | Per deploy script output |
| Mock safety on VPS | **Pass** | `OK: no production mock-data hazards found.` |
| Reports demo-data fix | **Not deployed** | Local uncommitted changes (`ReportsModule.tsx`, `App.tsx`, `PaymentsModule.tsx`, `reportLiveData.ts`) — not on `origin/main` |

### URL / health verification (external curl)

| URL | Result |
|---|---|
| `https://firstview.poultryhero.solutions` | **200** — Poultry Hero tenant login UI |
| `https://firstview.poultryhero.solutions/api/v1/health/` | **200** — `{"status":"ok","service":"poultryhero-api"}` |
| `POST /api/v1/auth/login/` (bad creds) | **JSON 401** — `No active account found…` (not DisallowedHost HTML 400) |
| `POST /api/v1/tenant/customers/` (no auth) | **JSON 401** — `Authentication credentials were not provided.` |

### Customer creation — production verification

| Step | Result | Notes |
|---|---|---|
| Add Customer sends live POST | **Likely pass (deployed code)** | Bundle contains `tenant/customers` API paths (6 refs); `ded78f1` wires `createCustomer()` |
| Manual UI smoke (Smoke Test Customer) | **Not run** | Requires First View owner login — credentials not available to agent |
| POST → 201 + list refresh + persist | **Pending** | Owner must confirm in DevTools after login |

### Reports demo data — production audit

| Check | Result |
|---|---|
| Demo strings in deployed bundle | **Present** — `مطعم الخليج` (19×), `WESTLAND` (18×), `INV-2025-0086` (9×) in `index-dMIyB4tH.js` |
| Reports fix (`liveOrMockRows`, gated mock) | **Not in production bundle** — fix is local-only, pending commit + push + deploy |
| Demo data source (current prod) | **Frontend mock fallback** (pre-fix bundle still live for reports UI) |
| DB counts / purge dry-run | **Not run** — agent SSH key auth denied |

### Required next deploy (reports fix)

```bash
# After commit + push reports changes to main:
cd /var/www/poultryhero && git pull origin main && bash scripts/deploy_vps.sh
```

**Launch stance:** **NO-GO** — customer fix deployed but not manually verified; reports demo fix not deployed; DB audit not run.

---

## Part L — Tenant create workflow deploy + verification (2026-07-05)

### Deploy status

| Item | Result | Notes |
|---|---|---|
| Commits on `main` | **`bff86fe`**, **`c7d747a`** | Reports demo guard + product/supplier/invoice fixes |
| First View bundle | **`index-DLgOG8Hc.js`** | Newer than `index-dMIyB4tH.js` — suggests redeploy occurred |
| Health | **Pass** | `{"status":"ok","service":"poultryhero-api"}` |
| Mock safety (local) | **Pass** | typecheck + build pass after fixes |

### Production bundle audit (2026-07-05)

| String / indicator | Count | Meaning |
|--------------------|------:|---------|
| `tenant/customers` | 6 | Customer API wired |
| `tenant/products` / createProduct | 2 | Product API wired |
| `WESTLAND` | 14 | Mock string literals still in bundle (dead code when `IS_MOCK_MODE=false`) |
| `مطعم الخليج` | 0* | Reports demo customer string not found in bundle (*encoding may affect count) |

### Manual smoke — **all pending** (requires First View owner login)

| Flow | Expected | Status |
|------|----------|--------|
| Add customer | POST 201, list refresh | Pending |
| Add product category | POST 201 | Pending |
| Add product | POST 201, SKU + category | Pending |
| Purchase draft + approve | POST 201, stock + | Pending |
| Sales draft + approve | POST 201, stock − | Pending |
| Reports | Empty/zero only | Pending |

**Launch stance:** **NO-GO** until owner completes manual smoke on First View.
