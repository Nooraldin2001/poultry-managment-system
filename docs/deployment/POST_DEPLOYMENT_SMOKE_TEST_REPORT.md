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

---

## Part M — Purchase PDF 404 + demo purge (2026-07-05)

### Commit / deploy

| Item | Result | Notes |
|---|---|---|
| Commit | **`0998fa0`** | Purchase print-preview API, frontend print routing, purge `--module purchases`, invoice `{ reason }` fix |
| Pushed to `origin/main` | **Pass** | 2026-07-05 |
| VPS deploy | **Not run** | Agent SSH: `Permission denied (publickey)` |
| First View bundle (curl) | **`index-DLgOG8Hc.js`** | Pre-`0998fa0` — new bundle will be `index-BhOKFWGr.js` after deploy |

### PDF 404 root cause (reproduced / confirmed)

| Finding | Detail |
|---|---|
| Clicked control | List/detail **Print / Save PDF** (`Printer` icon) |
| Failure mode (pre-fix prod) | (1) `openPrint()` did not set `selectedPurchaseId` → live mode fell back to mock `PurchPreviewScreen` (WESTLAND / Al Wataniya demo); (2) `GET /api/v1/tenant/purchases/{id}/print-preview/` **404** on prod (endpoint not deployed) |
| Request type | In-app route `purchases-preview` + API JSON (not raw `/pdf` URL) |
| Auth | API requires tenant JWT (401 without token) |
| Prod endpoint check (2026-07-05) | `GET …/purchases/1/print-preview/` → **404** (expected until deploy) |

### Fix (Option 1 — print preview + browser Save as PDF)

- Backend: `GET /api/v1/tenant/purchases/{id}/print-preview/` → JSON via `build_purchase_print_preview()`
- Frontend: `openPrint(recordId)` sets id then navigates; live mode never shows mock preview; labels **Print / Save PDF** / **طباعة / حفظ PDF**
- Missing id → `EmptyState`; API failure → `ApiUnavailableState` / `ErrorState`

### Local checks (2026-07-05)

| Check | Result |
|---|---|
| `pytest tests/test_purchases.py tests/test_tenant_demo_commands.py` | **38 passed** |
| `corepack pnpm run typecheck` | **Pass** |
| `corepack pnpm run build` | **Pass** → `index-BhOKFWGr.js` |
| `bash scripts/check_no_production_mock_data.sh` | **Pass** |

### Demo purchase cleanup — **not executed on VPS**

```bash
cd /var/www/poultryhero/backend
source /var/www/poultryhero/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py purge_tenant_demo_data --company-subdomain firstview --module purchases --dry-run
# review output, then:
python manage.py purge_tenant_demo_data --company-subdomain firstview --module purchases --confirm-delete-demo-data
```

### Required deploy + smoke

```bash
cd /var/www/poultryhero && git pull origin main && bash scripts/deploy_vps.sh
bash scripts/check_no_production_mock_data.sh
```

1. Purchases → Print / Save PDF → no 404, live company/supplier data, browser Save as PDF works
2. After purge → demo WESTLAND / Wataniya / `PUR-2025-0042` gone from list and reports
3. Create purchase → approve → inventory + supplier balance update

**Launch stance:** **NO-GO** — fix committed and pushed; VPS deploy, DB purge, and owner smoke pending.

---

## Part N — Auto numbering + Payment Methods Summary (2026-07-05)

### Root causes

| Issue | Root cause |
|-------|------------|
| Manual internal serial | Backend already auto-generates numbers; UI did not explain auto-generation before save |
| Payment Methods Summary demo data | `PaymentMethodSummaryScreen` always used hardcoded mock KPIs/movements (no live API) |

### Fixes (commit pending deploy)

| Area | Fix |
|------|-----|
| Numbering defaults | New tenants: `PUR-YYYY-####` / `SAL-YYYY-####` (yearly reset, length 4) |
| Backend | Reject client-sent `invoice_number` on create; `backfill_invoice_numbers` command |
| Frontend | Read-only internal number + “generated on save” message; supplier field labeled **Supplier Invoice No.** |
| Payment summary | Live API only in production; empty state when no movements |
| Purge | `--module payments` added to `purge_tenant_demo_data` |

### Local checks

| Check | Result |
|-------|--------|
| `pytest` purchases/sales/payments/demo commands | **98 passed** |
| `corepack pnpm run typecheck` | **Pass** |
| `corepack pnpm run build` | **Pass** → `index-DuTwgn9y.js` |
| `check_no_production_mock_data.sh` | **Pass** |

### VPS steps (after deploy)

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --module payments --dry-run
python manage.py purge_tenant_demo_data --company-subdomain firstview --module purchases --dry-run
```

**Launch stance:** **NO-GO** until deploy + owner smoke on numbering + payment summary.

---

## First View — Tax & Expenses fix (2026-07-05)

**Tenant:** `https://firstview.poultryhero.solutions`  
**Status:** Fix implemented locally; **not yet deployed** to VPS.

### Part A — Tax error reproduction (pre-fix production)

| Item | Finding |
|---|---|
| Failing endpoint | `GET /api/v1/tenant/tax/summary/` |
| Method | GET |
| Query params | **Missing** `date_from`, `date_to` on dashboard initial load |
| Response | HTTP **400** — `"date_from and date_to are required."` |
| Same-origin | Yes — `https://firstview.poultryhero.solutions/api/...` |
| Mock mode | `VITE_USE_MOCK_DATA=false` (production bundle) |

### Part B–G — Fix summary

See [TAX_MODULE_AUDIT.md](./TAX_MODULE_AUDIT.md) and [EXPENSE_MODULE_AUDIT.md](./EXPENSE_MODULE_AUDIT.md).

| Module | Root cause | Fix |
|---|---|---|
| Tax | No default dates; wrong API field mapping; mock KPIs in live UI | `getDefaultTaxDateRange()`, `withTaxDateRange()`, live totals |
| Expenses | Hardcoded `RECURRING`, `CAT_DIST`, `EXPENSE_TREND`, report table | Live API + empty states; mock gated by `IS_MOCK_MODE` |

### Expense demo purge (VPS — pending)

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --module expenses --dry-run
# Review output, then if only demo titles:
python manage.py purge_tenant_demo_data --company-subdomain firstview --module expenses --confirm-delete-demo-data
```

Dry-run on VPS: **not executed** (awaiting deploy + operator review).

### Checks (local)

| Check | Result |
|---|---|
| `corepack pnpm run typecheck` | **Pass** |
| `corepack pnpm run build` | **Pass** |
| `python manage.py check` | **Pass** |
| `pytest tests/test_tax.py tests/test_tenant_demo_commands.py` | **47 passed** |

### Production health (curl)

| URL | Result |
|---|---|
| `https://firstview.poultryhero.solutions` | HTTP 200 |
| `https://firstview.poultryhero.solutions/api/v1/health/` | `{"status":"ok","service":"poultryhero-api"}` |

**Launch stance (tax/expenses):** **NO-GO** until VPS deploy + First View owner smoke (Tax loads, Expenses show no demo rows).

---

## Phase 2 — Expenses create, statements, inventory (2026-07-05, local)

### Root causes fixed

| Issue | Root cause | Fix |
|---|---|---|
| Expenses not added | `AddExpenseModal` only called `toast.success()` — no POST | Wire `createExpense()` + API categories + refetch |
| Statements infinite load | Hooks after early return + missing customer/supplier ID + mock rows | Hooks reorder, live report API, ID propagation from statements center |
| Inventory not updating (UI) | Approve without persisting draft/lines first | `handleApprove` saves header + lines before approve |

### API exercised (local / tests)

- `POST /api/v1/tenant/expenses/`
- `GET /api/v1/tenant/expense-categories/`
- `GET /api/v1/tenant/reports/customers/{id}/statement/`
- `GET /api/v1/tenant/reports/suppliers/{id}/statement/`
- `POST /api/v1/tenant/purchases/{id}/approve/`
- `POST /api/v1/tenant/sales/{id}/approve/`

### Checks (local)

| Check | Result |
|---|---|
| `corepack pnpm run typecheck` | **Pass** |
| `corepack pnpm run build` | **Pass** |
| `python manage.py check` | **Pass** |
| `pytest tests/test_expenses.py tests/test_reports.py tests/test_purchases.py tests/test_sales.py` | **141 passed** |

### Deployment / production verification

| Step | Status |
|---|---|
| Commit to `main` | **Pending** (local changes uncommitted) |
| VPS `git pull` + `deploy_vps.sh` | **Not run** |
| First View owner smoke (expense create, statement, purchase/sale inventory) | **Pending deploy** |

**Launch stance (Phase 2):** **NO-GO** until deploy + First View verification passes.

---

## Phase 3 — First View ERP fixes (2026-07-05)

| Area | Code status | Tests |
|---|---|---|
| Users & Permissions (`users.view` on GET) | Fixed | `test_users.py` pass |
| Cancelled sales/purchases hidden from default list | Fixed | `test_sales.py`, `test_purchases.py` |
| Cancel modal → real API | Fixed | — |
| Sales/purchase price override | Fixed | override permission tests |
| Price history endpoints + UI dropdown | Fixed | history + tenant isolation tests |
| Frontend typecheck/build | **Pass** | `pnpm run typecheck`, `pnpm run build` |
| Backend targeted pytest | **89 passed** | users + sales + purchases |

### Manual smoke (First View admin — after deploy)

1. Settings → **المستخدمون والصلاحيات** → list + catalog load, no infinite spinner
2. Cancel approved sale/purchase with reason → disappears from active list → visible under **ملغاة**
3. Sales invoice → edit unit price → approve → print shows manual price
4. **اختيار سعر سابق** dropdown → select old price → save

Docs: [PRICING_OVERRIDE_AND_HISTORY.md](./PRICING_OVERRIDE_AND_HISTORY.md), [SALES_MODULE_AUDIT.md](./SALES_MODULE_AUDIT.md)

---

## Phase 4 — Customer edit (2026-07-05)

| Area | Code status | Tests |
|---|---|---|
| Customer list **تعديل** action | Fixed | — |
| Profile **تعديل بيانات العميل** | Fixed | — |
| Edit form prefill + PATCH save | Fixed | `test_customers.py` 20 passed |
| Permission `customers.edit` | Enforced | cashier 403 test |
| Frontend typecheck/build | **Pass** | — |

See [CUSTOMER_MODULE_AUDIT.md](./CUSTOMER_MODULE_AUDIT.md).

