# Post-Deployment Smoke Test Report

- **Date (UTC):** 2026-07-02 11:00 UTC (credentialed pass)
- **Environment:** Production
- **Domains:** `https://poultryhero.solutions`, `https://admin.poultryhero.solutions`
- **Health URL:** `https://poultryhero.solutions/api/v1/health/`
- **Commit under test:** `dcdd536`
- **Tester:** Release owner (manual Super Admin login) + Cursor Agent (browser/API verification)

---

## Infrastructure (pre-credentialed ? unchanged)

| Check | Result |
|---|---|
| URL health (main, admin, API) | **Pass** ? HTTP 200 |
| VPS env (`DJANGO_DEBUG=False`, `ALLOWED_HOSTS`) | **Pass** |
| Mock safety (Linux script + bundle) | **Pass** |
| Public login pages | **Pass** |

---

## Part A ? Super Admin credentialed test

| Step | Result | Notes |
|---|---|---|
| Super Admin login | **Pass** | Manual login; `poultry_hero_access_token` present |
| Dashboard loads | **Pass** | KPIs show `0`; quick actions visible |
| Companies list (real backend) | **Pass** | `GET /api/v1/admin/companies/` ? `count: 0` |
| No demo companies | **Pass** | Empty list; no `primefresh` / demo tenants |
| Create company via UI wizard | **Fail** | Wizard shows success UI but **does not call API**; list remains empty |
| Company appears in list | **Fail** | Blocked by UI wizard + missing plans seed |
| Plan/status fields | **N/A** | No companies created |
| Analytics unavailable/empty | **Pass** | Charts show `?? ???? ?????? ????? ???`; no fake revenue |
| Logout / re-login session | **Partial Pass** | Token persisted across admin reload (session OK); full logout cycle not re-tested to preserve session |

### Super Admin API verification (authenticated)

| Endpoint | Status | Result |
|---|---|---|
| `GET /api/v1/auth/me/` | 200 | Super Admin user (`is_superuser: true`) |
| `GET /api/v1/admin/companies/` | 200 | Empty paginated list (real data) |
| `GET /api/v1/admin/plans/` | 200 | **Empty array `[]`** ? plans not seeded |
| `POST /api/v1/admin/companies/` | 400 | `plan_code: ["Unknown or inactive plan."]` |

### Console / network (Super Admin)

- API calls target `https://poultryhero.solutions/api`
- No localhost or mock-data warnings observed
- No critical console crashes on dashboard/companies flows

**Super Admin classification:** Partial pass ? auth and read paths work; **company provisioning blocked**.

---

## Part B ? Tenant owner/admin test

| Step | Result | Notes |
|---|---|---|
| Tenant owner created | **Fail** | No company/admin user provisioned |
| Login at `https://poultryhero.solutions` | **Blocked** | Main domain serves Super Admin login screen |
| Tenant dashboard | **Blocked** | No tenant company exists |
| Empty states / no fake data | **Blocked** | |
| Navigation modules | **Blocked** | |
| Logout / invalid login | **Not tested** | Tenant session unavailable |

**Classification:** **Blocked** ? depends on company + tenant user provisioning.

---

## Part C ? Core ERP workflow

All steps **Blocked** ? no tenant company or owner user exists.

Planned smoke data (not created):

- Product: `Fresh Chicken 1000g` / `CHK-1000`
- Customer: `Smoke Test Customer`
- Supplier: `Smoke Test Supplier`
- Purchase/sales/collection/quotation/expense/tax/reports flows

---

## Part D ? Permission smoke test

**Blocked** ? cannot create accountant/cashier users without tenant company.

---

## Part E ? Print preview smoke test

**Blocked** ? no transactional records.

---

## Part F ? Mobile smoke test

| Screen | Result |
|---|---|
| Super Admin dashboard (390×844) | **Pass** | Layout stacks; RTL correct; bottom nav usable |
| Tenant in-app flows | **Blocked** | No tenant session |

---

## Part G ? Server logs

Not captured live during this browser session. **Recommended:** run in VPS SSH during re-test after fixes:

```bash
journalctl -u poultryhero-backend -f
tail -f /var/log/nginx/error.log
```

No `500`/`502` observed from browser/API probes during credentialed pass.

---

## Confirmed release blockers

### Blocker 1 ? Super Admin create-company wizard is UI-only (fake success)

`CreateCompanyWizard` in `frontend/src/app/App.tsx` sets `done=true` and shows toast on submit **without** calling `POST /api/v1/admin/companies/`. User sees ??? ????? ?????? ?????!? but no company is created.

**Severity:** Release blocker (misleading success + cannot onboard tenants).

### Blocker 2 ? Production plans reference data not seeded

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

## Part H ? Tenant subdomain login (2026-07-04)

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

**Root cause:** Django `DisallowedHost` ? production `ALLOWED_HOSTS` missing `.poultryhero.solutions`, so tenant subdomain API requests are rejected before auth runs.

**Fix in repo (pending VPS deploy):**

- `backend/config/settings/production.py` ? auto-append `.poultryhero.solutions` to `ALLOWED_HOSTS`
- `scripts/fix_production_allowed_hosts.sh` ? patch `.env` + restart backend
- Frontend/backend auth contract already uses `email` (`User.USERNAME_FIELD = "email"`)

**After deploy expected:**

- Health: `{"status":"ok","service":"poultryhero-api"}`
- Wrong password: JSON `401` with DRF detail
- Valid First View tenant: JSON `200` + JWT; `/api/v1/auth/me/` returns First View company context

---

## Part I ? Tenant customer creation (2026-07-04)

| Step | Result | Notes |
|---|---|---|
| Add Customer form submits | **Fail (pre-fix)** | UI-only toast; **no POST** sent |
| Customer appears in list | **Fail (pre-fix)** | Nothing persisted |
| Visible error on failure | **Fail (pre-fix)** | Fake success toast |

### Root cause (code)

`CreateCustomerScreen` in `frontend/src/app/CustomerModule.tsx` called `toast.success()` and navigated back **without** calling `createCustomer()` / `POST /api/v1/tenant/customers/`.

Live service layer existed (`customerService.createCustomer`, `buildCustomerCreatePayload`) but was **never wired** from the UI ? same pattern as the old company wizard fake success.

### Fix in repo

- Wire `handleSave` ? `createCustomer(buildCustomerCreatePayload(...))`
- Loading/disabled submit, `FormErrors` for DRF validation, permission denied for cashier
- Expanded payload mapper (`name_ar`, `phone`, optional fields, opening balance enums)
- Load customer categories from `GET /api/v1/tenant/customer-categories/` when available (category optional)
- List refreshes on return (screen remount refetches `GET /api/v1/tenant/customers/`)

### After deploy expected

- `POST /api/v1/tenant/customers/` ? **201** with real customer JSON
- New customer visible in list immediately and after browser refresh
- Validation errors shown on form (missing `name_ar` / `phone`)

---

## Part J ? Reports demo data + First View cleanup (2026-07-04)

| Step | Result | Notes |
|---|---|---|
| Reports show fake names (???? ??????, WESTLAND, etc.) | **Fail (pre-fix)** | Hardcoded `R_*` sample arrays rendered even when `IS_MOCK_MODE=false` |
| Reports use live API only | **Fixed in code** | `ReportsModule.tsx`, `PaymentsModule.tsx`, tenant dashboard sections |
| DB demo data purge dry-run | **Not run** | Requires VPS SSH (`purge_tenant_demo_data --company-subdomain firstview --dry-run`) |
| DB demo data purge confirm | **Not run** | Pending dry-run review |

### Root cause ? reports demo data

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

### After deploy ? manual smoke (First View)

1. Login at `https://firstview.poultryhero.solutions`
2. Open Reports ? verify zeros / ?No real data yet?, not demo names
3. Add Customer ? verify `POST 201`, row in list, persists after refresh
4. Run purge dry-run on VPS; confirm only demo-pattern rows before `--confirm-delete-demo-data`

**Launch stance:** **NO-GO** until deploy + manual First View ERP smoke passes.

---

## Part K ? Production deploy + verification (2026-07-04 evening)

### Deploy status

| Item | Result | Notes |
|---|---|---|
| `git pull origin main` + `deploy_vps.sh` | **Pass** | VPS deploy completed (user SSH session); bundle `index-dMIyB4tH.js` built 2026-07-04 ~17:41 UTC |
| Deployed commit | **`ded78f1`** | Customer creation fix (`CreateCustomerScreen` ? live POST) |
| Backend restart / Nginx reload | **Pass** | Per deploy script output |
| Mock safety on VPS | **Pass** | `OK: no production mock-data hazards found.` |
| Reports demo-data fix | **Not deployed** | Local uncommitted changes (`ReportsModule.tsx`, `App.tsx`, `PaymentsModule.tsx`, `reportLiveData.ts`) ? not on `origin/main` |

### URL / health verification (external curl)

| URL | Result |
|---|---|
| `https://firstview.poultryhero.solutions` | **200** ? Poultry Hero tenant login UI |
| `https://firstview.poultryhero.solutions/api/v1/health/` | **200** ? `{"status":"ok","service":"poultryhero-api"}` |
| `POST /api/v1/auth/login/` (bad creds) | **JSON 401** ? `No active account found?` (not DisallowedHost HTML 400) |
| `POST /api/v1/tenant/customers/` (no auth) | **JSON 401** ? `Authentication credentials were not provided.` |

### Customer creation ? production verification

| Step | Result | Notes |
|---|---|---|
| Add Customer sends live POST | **Likely pass (deployed code)** | Bundle contains `tenant/customers` API paths (6 refs); `ded78f1` wires `createCustomer()` |
| Manual UI smoke (Smoke Test Customer) | **Not run** | Requires First View owner login ? credentials not available to agent |
| POST ? 201 + list refresh + persist | **Pending** | Owner must confirm in DevTools after login |

### Reports demo data ? production audit

| Check | Result |
|---|---|
| Demo strings in deployed bundle | **Present** ? `???? ??????` (19×), `WESTLAND` (18×), `INV-2025-0086` (9×) in `index-dMIyB4tH.js` |
| Reports fix (`liveOrMockRows`, gated mock) | **Not in production bundle** ? fix is local-only, pending commit + push + deploy |
| Demo data source (current prod) | **Frontend mock fallback** (pre-fix bundle still live for reports UI) |
| DB counts / purge dry-run | **Not run** ? agent SSH key auth denied |

### Required next deploy (reports fix)

```bash
# After commit + push reports changes to main:
cd /var/www/poultryhero && git pull origin main && bash scripts/deploy_vps.sh
```

**Launch stance:** **NO-GO** ? customer fix deployed but not manually verified; reports demo fix not deployed; DB audit not run.

---

## Part L ? Tenant create workflow deploy + verification (2026-07-05)

### Deploy status

| Item | Result | Notes |
|---|---|---|
| Commits on `main` | **`bff86fe`**, **`c7d747a`** | Reports demo guard + product/supplier/invoice fixes |
| First View bundle | **`index-DLgOG8Hc.js`** | Newer than `index-dMIyB4tH.js` ? suggests redeploy occurred |
| Health | **Pass** | `{"status":"ok","service":"poultryhero-api"}` |
| Mock safety (local) | **Pass** | typecheck + build pass after fixes |

### Production bundle audit (2026-07-05)

| String / indicator | Count | Meaning |
|--------------------|------:|---------|
| `tenant/customers` | 6 | Customer API wired |
| `tenant/products` / createProduct | 2 | Product API wired |
| `WESTLAND` | 14 | Mock string literals still in bundle (dead code when `IS_MOCK_MODE=false`) |
| `???? ??????` | 0* | Reports demo customer string not found in bundle (*encoding may affect count) |

### Manual smoke ? **all pending** (requires First View owner login)

| Flow | Expected | Status |
|------|----------|--------|
| Add customer | POST 201, list refresh | Pending |
| Add product category | POST 201 | Pending |
| Add product | POST 201, SKU + category | Pending |
| Purchase draft + approve | POST 201, stock + | Pending |
| Sales draft + approve | POST 201, stock ? | Pending |
| Reports | Empty/zero only | Pending |

**Launch stance:** **NO-GO** until owner completes manual smoke on First View.

---

## Part M ? Purchase PDF 404 + demo purge (2026-07-05)

### Commit / deploy

| Item | Result | Notes |
|---|---|---|
| Commit | **`0998fa0`** | Purchase print-preview API, frontend print routing, purge `--module purchases`, invoice `{ reason }` fix |
| Pushed to `origin/main` | **Pass** | 2026-07-05 |
| VPS deploy | **Not run** | Agent SSH: `Permission denied (publickey)` |
| First View bundle (curl) | **`index-DLgOG8Hc.js`** | Pre-`0998fa0` ? new bundle will be `index-BhOKFWGr.js` after deploy |

### PDF 404 root cause (reproduced / confirmed)

| Finding | Detail |
|---|---|
| Clicked control | List/detail **Print / Save PDF** (`Printer` icon) |
| Failure mode (pre-fix prod) | (1) `openPrint()` did not set `selectedPurchaseId` ? live mode fell back to mock `PurchPreviewScreen` (WESTLAND / Al Wataniya demo); (2) `GET /api/v1/tenant/purchases/{id}/print-preview/` **404** on prod (endpoint not deployed) |
| Request type | In-app route `purchases-preview` + API JSON (not raw `/pdf` URL) |
| Auth | API requires tenant JWT (401 without token) |
| Prod endpoint check (2026-07-05) | `GET ?/purchases/1/print-preview/` ? **404** (expected until deploy) |

### Fix (Option 1 ? print preview + browser Save as PDF)

- Backend: `GET /api/v1/tenant/purchases/{id}/print-preview/` ? JSON via `build_purchase_print_preview()`
- Frontend: `openPrint(recordId)` sets id then navigates; live mode never shows mock preview; labels **Print / Save PDF** / **????? / ??? PDF**
- Missing id ? `EmptyState`; API failure ? `ApiUnavailableState` / `ErrorState`

### Local checks (2026-07-05)

| Check | Result |
|---|---|
| `pytest tests/test_purchases.py tests/test_tenant_demo_commands.py` | **38 passed** |
| `corepack pnpm run typecheck` | **Pass** |
| `corepack pnpm run build` | **Pass** ? `index-BhOKFWGr.js` |
| `bash scripts/check_no_production_mock_data.sh` | **Pass** |

### Demo purchase cleanup ? **not executed on VPS**

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

1. Purchases ? Print / Save PDF ? no 404, live company/supplier data, browser Save as PDF works
2. After purge ? demo WESTLAND / Wataniya / `PUR-2025-0042` gone from list and reports
3. Create purchase ? approve ? inventory + supplier balance update

**Launch stance:** **NO-GO** ? fix committed and pushed; VPS deploy, DB purge, and owner smoke pending.

---

## Part N ? Auto numbering + Payment Methods Summary (2026-07-05)

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
| Frontend | Read-only internal number + ?generated on save? message; supplier field labeled **Supplier Invoice No.** |
| Payment summary | Live API only in production; empty state when no movements |
| Purge | `--module payments` added to `purge_tenant_demo_data` |

### Local checks

| Check | Result |
|-------|--------|
| `pytest` purchases/sales/payments/demo commands | **98 passed** |
| `corepack pnpm run typecheck` | **Pass** |
| `corepack pnpm run build` | **Pass** ? `index-DuTwgn9y.js` |
| `check_no_production_mock_data.sh` | **Pass** |

### VPS steps (after deploy)

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --module payments --dry-run
python manage.py purge_tenant_demo_data --company-subdomain firstview --module purchases --dry-run
```

**Launch stance:** **NO-GO** until deploy + owner smoke on numbering + payment summary.

---

## First View ? Tax & Expenses fix (2026-07-05)

**Tenant:** `https://firstview.poultryhero.solutions`  
**Status:** Fix implemented locally; **not yet deployed** to VPS.

### Part A ? Tax error reproduction (pre-fix production)

| Item | Finding |
|---|---|
| Failing endpoint | `GET /api/v1/tenant/tax/summary/` |
| Method | GET |
| Query params | **Missing** `date_from`, `date_to` on dashboard initial load |
| Response | HTTP **400** ? `"date_from and date_to are required."` |
| Same-origin | Yes ? `https://firstview.poultryhero.solutions/api/...` |
| Mock mode | `VITE_USE_MOCK_DATA=false` (production bundle) |

### Part B?G ? Fix summary

See [TAX_MODULE_AUDIT.md](./TAX_MODULE_AUDIT.md) and [EXPENSE_MODULE_AUDIT.md](./EXPENSE_MODULE_AUDIT.md).

| Module | Root cause | Fix |
|---|---|---|
| Tax | No default dates; wrong API field mapping; mock KPIs in live UI | `getDefaultTaxDateRange()`, `withTaxDateRange()`, live totals |
| Expenses | Hardcoded `RECURRING`, `CAT_DIST`, `EXPENSE_TREND`, report table | Live API + empty states; mock gated by `IS_MOCK_MODE` |

### Expense demo purge (VPS ? pending)

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

## Phase 2 ? Expenses create, statements, inventory (2026-07-05, local)

### Root causes fixed

| Issue | Root cause | Fix |
|---|---|---|
| Expenses not added | `AddExpenseModal` only called `toast.success()` ? no POST | Wire `createExpense()` + API categories + refetch |
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

## Phase 3 ? First View ERP fixes (2026-07-05)

| Area | Code status | Tests |
|---|---|---|
| Users & Permissions (`users.view` on GET) | Fixed | `test_users.py` pass |
| Cancelled sales/purchases hidden from default list | Fixed | `test_sales.py`, `test_purchases.py` |
| Cancel modal ? real API | Fixed | ? |
| Sales/purchase price override | Fixed | override permission tests |
| Price history endpoints + UI dropdown | Fixed | history + tenant isolation tests |
| Frontend typecheck/build | **Pass** | `pnpm run typecheck`, `pnpm run build` |
| Backend targeted pytest | **89 passed** | users + sales + purchases |

### Manual smoke (First View admin ? after deploy)

1. Settings ? **?????????? ??????????** ? list + catalog load, no infinite spinner
2. Cancel approved sale/purchase with reason ? disappears from active list ? visible under **?????**
3. Sales invoice ? edit unit price ? approve ? print shows manual price
4. **?????? ??? ????** dropdown ? select old price ? save

Docs: [PRICING_OVERRIDE_AND_HISTORY.md](./PRICING_OVERRIDE_AND_HISTORY.md), [SALES_MODULE_AUDIT.md](./SALES_MODULE_AUDIT.md)

---

## Phase 4 ? Customer edit (2026-07-05)

| Area | Code status | Tests |
|---|---|---|
| Customer list **?????** action | Fixed | ? |
| Profile **????? ?????? ??????** | Fixed | ? |
| Edit form prefill + PATCH save | Fixed | `test_customers.py` 20 passed |
| Permission `customers.edit` | Enforced | cashier 403 test |
| Frontend typecheck/build | **Pass** | ? |

See [CUSTOMER_MODULE_AUDIT.md](./CUSTOMER_MODULE_AUDIT.md).

---

## Phase 5 ? First View production blockers (2026-07-05)

**Tenant:** `firstview` (`https://firstview.poultryhero.solutions`)  
**Mock mode:** `VITE_USE_MOCK_DATA=false` (unchanged)

### Root causes and fixes

| Client issue (AR) | Root cause | Fix |
|---|---|---|
| ????? ???????? ?? ?????? | PATCH sent full create payload without required `reason` on price/carton changes ? 400; incomplete form hydration | `buildProductUpdatePayload()`, `ReasonModal` on sensitive changes, fixed prefill |
| ?? ????? ????? | Create POST worked but list mapper used `amount`/`notes` instead of `total_amount`/`title` ? AED 0 rows | Fixed `mapApiExpenseToRow()` |
| ??? ????? ????? ????????? | POST missing required `code` field ? 400 | Auto-generate `code` in `createExpenseCategory()` |
| KG not auto from cartons | Cartons change did not recalc KG; purchase screen lacked cartons column | `lineQuantities.ts` + wired sales/purchase invoice screens |
| ????? ?????? ????????? | No frontend for `POST ?/opening-balance/` | Profile modal + `updateCustomerOpeningBalance()` |

### Carton calculation rule

```text
kg_per_piece = weight_grams / 1000
total_pieces = cartons × pieces_per_carton + loose_pieces
total_kg = total_pieces × kg_per_piece
```

Example: 500g × 10 ppc × 10 cartons = **50 KG** (100 pieces).

### API endpoints (live mode)

| Workflow | Endpoint |
|---|---|
| Product edit | `PATCH /api/v1/tenant/products/{id}/` (+ `reason` when price/carton changes) |
| Expense create | `POST /api/v1/tenant/expenses/` |
| Expense category | `POST /api/v1/tenant/expense-categories/` |
| Opening balance | `POST /api/v1/tenant/customers/{id}/opening-balance/` |

### Checks (local)

| Check | Result |
|---|---|
| `pytest tests/test_products.py tests/test_expenses.py tests/test_customers.py tests/test_purchases.py tests/test_sales.py` | **152 passed** |
| `python manage.py check` | **Pass** |
| `corepack pnpm run typecheck` | **Pass** |
| `corepack pnpm run build` | **Pass** |

### Deployment / production verification

| Step | Status |
|---|---|
| Commit + push to `main` | **Pending** (uncommitted local changes) |
| VPS deploy | **Not run** (SSH unavailable / pending owner) |
| First View credentialed smoke | **Pending deploy + owner login** |

**Launch stance (Phase 5):** **NO-GO** until deploy + First View owner verification.

See: [PRODUCT_MODULE_AUDIT.md](./PRODUCT_MODULE_AUDIT.md), [EXPENSE_MODULE_AUDIT.md](./EXPENSE_MODULE_AUDIT.md), [CUSTOMER_MODULE_AUDIT.md](./CUSTOMER_MODULE_AUDIT.md), [PURCHASE_MODULE_AUDIT.md](./PURCHASE_MODULE_AUDIT.md), [SUPPLIER_MODULE_AUDIT.md](./SUPPLIER_MODULE_AUDIT.md).

---

## Phase 6 ? Purchase Not Found, product/supplier edit (2026-07-05)

| Issue | Root cause | Fix |
|---|---|---|
| ?????? ????????? Not Found | Stale `selectedPurchaseId` on `purchases-new` triggered detail GET 404 | Clear ID on new purchase; `purchases-edit` route for drafts; `NotFoundState` |
| ????? ???????? | List **Edit** opened `products-new` without product ID | Route to `products-edit` with `setSelectedProductId` |
| ????? ???????? | No edit route; edit opened create form (POST only) | `suppliers-edit` + PATCH via `buildSupplierUpdatePayload` |

| Check | Result |
|---|---|
| `pytest` purchases/products/suppliers/inventory | **96 passed** |
| `pnpm run typecheck` / `build` | **Pass** |
| Commit + push | **Done** ? `88822cd`, `22c4ba0`, allowlist fix |
| VPS deploy | **Pending** ? production still on `index--O_NXaJC.js` (pre-`88822cd`). Run deploy in SSH session. |
| First View credentialed smoke | **Pending deploy + owner login** |

---

## Phase 7 ? Sales white screen (2026-07-05)

| Issue | Root cause | Fix |
|---|---|---|
| ???????? ???? ???? | API `status: "partially_paid"` crashed `SInvStatusBadge` (expected `partial`) | `normalizeSalesInvoiceStatus()` + defensive badge; `ModuleErrorBoundary` on sales routes |

| Check | Result |
|---|---|
| `pnpm run typecheck` / `build` | **Pass** |
| Nginx cache headers | Updated in `deploy/nginx/poultryhero.conf` |
| VPS deploy | **Pending** |
| Mobile Safari smoke | **Pending deploy + owner login** |

See [SALES_MODULE_AUDIT.md](./SALES_MODULE_AUDIT.md).

---

## Phase 8 ? Reports demo KPI values (2026-07-05)

| Issue | Root cause | Fix |
|---|---|---|
| ???????? ???? ????? ????? | `ReportsHomeScreen` KPI cards hardcoded (never called API) | Live fetch `GET /tenant/reports/dashboard/` today + month; `formatReportAed()` |

| Check | Result |
|---|---|
| `pytest tests/test_reports.py` | **30 passed** |
| `pnpm run typecheck` / `build` | **Pass** |
| DB dry-run (firstview) | **Not run** (SSH unavailable) |
| VPS deploy | **Pending** |

See [REPORTS_MODULE_AUDIT.md](./REPORTS_MODULE_AUDIT.md).

---

## Phase 9 ? Purchase no-VAT + inventory on approve (2026-07-05)

**Client report (AR):** `????????? ?? ????? ??????? ???? ????? ???? ????? make the vat optional as the sales invoices`

| Issue | Root cause | Fix |
|---|---|---|
| VAT required / wrong totals on no-VAT purchase | `LivePurchaseInvoiceScreen` hardcoded line `vatRate: 5`; no VAT toggle UI; header `vat_rate` not PATCHed on save/approve | VAT toggle (`???? ?????` / `No VAT`); line/header `vat_rate: 0`; subtotal/VAT/total sidebar |
| Header VAT ignored in totals when off | Backend summed stale line VAT when header `vat_rate=0` | `recalculate_purchase_invoice`: header VAT off ? line VAT forced to 0, invoice `vat_amount=0` |
| Inventory not increasing after approve | Cartons saved without derived KG (fixed-weight); UI never refetched inventory | Backend `_normalize_line_quantities_for_stock()` on approve; frontend `notifyTenantDataChanged()` refreshes inventory/purchases/suppliers lists |

### API exercised (local tests)

| Action | Endpoint | Payload |
|---|---|---|
| Create no-VAT draft | `POST /api/v1/tenant/purchases/` | `vat_rate: "0.00"`, line `vat_rate: "0.00"` |
| Approve | `POST /api/v1/tenant/purchases/{id}/approve/` | `{ "reason": "received" }` |

### Inventory proof (pytest)

| Scenario | Before | After approve |
|---|---|---|
| No-VAT purchase 100 kg | `available_kg=0` | `available_kg=100`, FIFO layer + `PURCHASE_APPROVED` movement |
| Cartons-only fixed-weight (10 ct) | `available_kg=0` | `available_kg=100` (derived from product weight) |
| Draft no-VAT | unchanged | unchanged until approve |
| Double approve | ? | ValidationError (no double stock) |

### Supplier / tax proof

| Check | Result |
|---|---|
| Supplier balance after no-VAT approve | `current_balance == subtotal` (no VAT) |
| Tax bridge `input_vat` for no-VAT purchase | `0` |

### Checks

| Check | Result |
|---|---|
| `pytest tests/test_purchases.py tests/test_inventory.py tests/test_reports.py` | **112 passed** |
| `python manage.py check` | **Pass** |
| `pnpm run typecheck` / `build` | **Pass** |
| VPS deploy | **Pending** ? run in active SSH session |
| First View credentialed smoke | **Pending deploy** ? create no-VAT purchase ? approve ? verify stock |

See [PURCHASE_MODULE_AUDIT.md](./PURCHASE_MODULE_AUDIT.md), [INVENTORY_SIDE_EFFECTS_AUDIT.md](./INVENTORY_SIDE_EFFECTS_AUDIT.md), [TAX_MODULE_AUDIT.md](./TAX_MODULE_AUDIT.md).

---

## Phase 10 ? Inventory UI zero + repair command (2026-07-06)

**Client evidence:** Approved `PINV-00005` / `PINV-00006` (supplier `????? ??????`) show **??????** with net due, but inventory page shows **0 cartons / 0 KG / AED 0**.

| Issue | Classification | Fix |
|---|---|---|
| Inventory page all zeros | **Case 2** ? API field mismatch | `inventoryService.ts`: map `available_cartons/pieces/kg`, `kg_delta`, `estimated_fifo_value` |
| Approved purchases no stock | **Case 1** ? missing side effects when `quantity_kg=0` | Approve normalize + `repair_purchase_inventory_side_effects` command |
| Cartons-only lines | **Case 3** | Server derive 50 ct × 10 ppc × 500g = 250 KG |

### VPS diagnosis (agent SSH blocked ? run in owner session)

```bash
python scripts/diagnose_tenant_purchase_inventory.py firstview
python manage.py repair_purchase_inventory_side_effects --company-subdomain firstview --dry-run
```

### Checks

| Check | Result |
|---|---|
| `pytest tests/test_purchases.py tests/test_inventory.py` | **84 passed** |
| `pnpm run typecheck` | **Pass** |
| VPS dry-run / confirm repair | **Pending owner SSH** |
| First View inventory after repair | **Pending** |

---

## Phase 11 ? Poultry cuts on purchase invoices (2026-07-06)

**Client requirement (AR):** `?????? ????????? ?? ?? ?????? ??? ????? ???? ?????? ????? ????????? ?? ??????? ???? ?? ???????`

| Cut products | Backend type | Purchase line |
|---|---|---|
| ????? ?????? ????? ????? ?????? ?????? ??? | `chicken_part` | KG required; cartons optional/0 |

| Check | Result |
|---|---|
| `pytest tests/test_products.py tests/test_purchases.py tests/test_inventory.py tests/test_sales.py` | **142 passed** |
| `python manage.py check` | **Pass** |
| `pnpm run typecheck` | **Pass** |
| Seed cuts (optional) | `seed_poultry_cut_products --company-subdomain firstview --confirm` |
| Production smoke | **Pending** ? purchase ???? 25 KG no VAT ? approve ? inventory +25 KG |

---

## Phase 12 ? Invoice branding & tax identity (2026-07-06)

**Goal:** Official invoices show company identity (name AR/EN, TRN, logo, stamp, signature) and customer TRN on sales print preview.

| Area | Implementation |
|---|---|
| Company model | `name_ar`, `name_en`, `trn`, `logo`, `stamp`, `signature`, `phone`, `address`, `email` ? paths `company_assets/{company_id}/{kind}/` |
| Shared print helper | `apps/tenants/print_identity.py` ? `build_company_print_identity`, `build_sales_customer_party` |
| Print previews | Sales, purchase, quotation, payment receipt, expense voucher ? absolute asset URLs via request |
| Sales snapshots | `customer_*_snapshot` on create; refresh on draft customer change; **frozen at approval** |
| Customer TRN | `Customer.trn` on POST/PATCH; digits-only validation |
| Super Admin UI | `AdminCompanyEditScreen` ? Company Identity & Invoice Branding section |
| Print UI | `PrintPreviewLayout` ? company/customer TRN labels, logo 80px, stamp 160px, signature 180px |

| Check | Result |
|---|---|
| `pytest tests/test_invoice_branding.py` | **9 passed** |
| `pytest tests/test_admin_companies.py tests/test_company_identity.py` | **Pass** |
| `python manage.py check` | **Pass** |
| `pnpm run typecheck` / `build` | **Pass** |
| Production smoke | **Pending** ? Super Admin upload assets + First View sales print preview + PDF |

See [INVOICE_BRANDING_AND_TAX_IDENTITY.md](./INVOICE_BRANDING_AND_TAX_IDENTITY.md).

**Launch stance (Phase 12):** **NO-GO** until deploy + First View invoice branding smoke passes.

---

## Phase 13 ? Sales edit Not Found (2026-07-06)

**Client report (AR):** `????? ?????? ???` shows `No Sale Invoice matches the given query.` ? edit form partially renders without invoice data.

| Root cause | Detail |
|---|---|
| Wrong route | Edit navigated to `sales-new` with stale/wrong `selectedSalesId` (same pattern as purchase Not Found) |
| Wrong ID fallback | List row actions used `recordId ?? inv.id` ? `inv.id` is **invoice_number** (e.g. `SAL-2026-00002`), not database PK |
| Pre-filled `docId` | `LiveSalesInvoiceScreen` initialized `docId` from `invoiceId` before load ? 404 guard `!docId` failed, form rendered with raw DRF error in `FormErrors` |
| Missing invoice default | `SalesDetailLiveRouter` treated `getSalesDetail` failure as `status ?? "draft"` ? opened empty edit form |
| Backend (cancelled detail) | `get_queryset` excluded cancelled invoices on **retrieve** ? detail 404 for cancelled IDs |

| Fix | Files |
|---|---|
| Split routes | `sales-new` = new only (clears `selectedSalesId`); `sales-edit` = draft edit |
| Database ID only | List view/edit/collect/cancel/print pass `recordId` (API `id`) |
| NotFoundState | `LiveSalesInvoiceScreen`, `SalesDetailLiveRouter`, `SalesEditLiveRouter` ? AR/EN + Back to Sales |
| Status routing | Draft ? editable builder; approved/partial/paid/cancelled ? `LiveDocumentReadOnly` |
| `getSalesDetail` | Throws `ApiError` 404 (no silent null) |
| Backend queryset | Cancelled filter applies to **list** only; retrieve by ID works |

| API tested | Result |
|---|---|
| `GET /api/v1/tenant/sales/` | Returns `id` + `invoice_number` per row |
| `GET /api/v1/tenant/sales/{id}/` | 200 draft/approved/cancelled; 404 invalid/other tenant |
| `PATCH /api/v1/tenant/sales/{id}/` | 200 draft; rejected when approved |

| Check | Result |
|---|---|
| `pytest tests/test_sales.py` | **49 passed** |
| `python manage.py check` | **Pass** |
| `pnpm run typecheck` / `build` | **Pass** |
| Production smoke (First View) | **Pending** ? deploy + owner edit draft / view approved / invalid ID NotFoundState |

See [SALES_MODULE_AUDIT.md](./SALES_MODULE_AUDIT.md).

**Launch stance (Phase 13):** **NO-GO** until deploy + First View sales edit/detail smoke passes.

---

## Phase 14 ? Invoice template & color theme system

| Area | Status |
|---|---|
| `InvoiceDesignSettings` model + migration | **Done** |
| API `GET/PATCH /tenant/settings/print-template/` | **Done** |
| API `GET /tenant/settings/print-template/catalog/` | **Done** |
| Sales/purchase print preview `branding` block | **Done** |
| Frontend template registry (4 templates, 7 themes) | **Done** |
| Settings ? Invoice Design screen | **Done** |
| `firstview_style` template (official tax invoice layout) | **Done** |
| A4 print CSS + row break avoidance | **Done** |

| Check | Result |
|---|---|
| `pytest` (188 tests, branding/settings/sales/purchases) | **Pass** |
| `pnpm typecheck` / `build` | **Pass** |
| Production smoke (First View invoice design + print) | **Pending** |

See [INVOICE_BRANDING_AND_TEMPLATES.md](./INVOICE_BRANDING_AND_TEMPLATES.md).

**Launch stance (Phase 14):** **NO-GO** until deploy + First View invoice design + print preview smoke passes.


---

## Treasury & purchase payment side effects (Phase 15 ? 2026-07-08)

Implemented:
- `MoneyAccount` + `MoneyMovement` models with tenant-scoped balances
- Treasury endpoints (`/tenant/money-accounts/*`, `/tenant/treasury/summary/`)
- Purchase approval now:
  - deducts paid amount from selected cashbox/bank account
  - posts supplier payable only for outstanding amount
  - supports credit/full/partial flows correctly
- Purchase cancellation reverses treasury movement and supplier payable posting

Checks:
- `python -m pytest tests/test_payments.py tests/test_purchases.py tests/test_sales.py tests/test_inventory.py tests/test_suppliers.py tests/test_invoice_branding.py` ? **198 passed**

Docs:
- `TREASURY_AND_BANK_ACCOUNTS.md`
- `PURCHASE_PAYMENT_FLOW.md`
- `INVOICE_LINE_DELETE_RULES.md`
- `INVOICE_PRINT_PAGINATION.md`

---

## Phase 16 ? Mobile invoice A4 print layout (2026-07-08)

### Root cause

| Issue | Cause |
|-------|-------|
| Invoice too small on iPhone PDF | `.print-preview-doc { width: 100% }` used viewport width, not 210mm A4 |
| Huge blank space / extra page | `h-screen` app shell + `visibility:hidden` print hack left empty printable area |
| Mobile responsive table in print | `max-w-3xl`, viewport-based wrappers applied before print CSS |

### Fix applied

| Area | Change |
|------|--------|
| A4 wrapper | `PrintA4Shell` ? `.print-shell` > `.invoice-a4-page` (210mm screen + print) |
| Print CSS | `print-a4.css` ? `@page A4`, hide tenant sidebar/topbar/bottom-nav/FAB |
| Print button | `triggerPrint()` double-rAF before `window.print()` |
| Templates | `InvoiceTemplateRenderer`, `PrintPreviewLayout` use A4 shell |
| Table columns | Qty = cartons, Unit = KG (unchanged) |

### Reproduction notes (pre-fix)

| Environment | Symptom |
|-------------|---------|
| Desktop Chrome print preview | Acceptable layout but inherited visibility hack |
| Mobile 390px responsive | Invoice preview constrained to ~390px width |
| iPhone Safari Save PDF | Tiny invoice, large blank area, 2 pages |

### Verification (post-fix ? pending production)

| # | Check | Desktop | Mobile |
|---|-------|---------|--------|
| 1 | A4 full-width invoice (not tiny) | Pending deploy | Pending deploy |
| 2 | No blank second page (short invoice) | Pending | Pending |
| 3 | Long invoice multi-page | Pending | Pending |
| 4 | No sidebar/nav/FAB in PDF | Pending | Pending |
| 5 | Logo/TRN/stamp/signature | Pending | Pending |
| 6 | Qty=cartons, Unit=KG | Pending | Pending |

### Automated checks (local)

| Check | Result |
|-------|--------|
| `pnpm run typecheck` | **Pass** |
| `pnpm run build` | **Pass** |

See [INVOICE_PRINT_PAGINATION.md](./INVOICE_PRINT_PAGINATION.md).

**Launch stance (Phase 16):** Deploy frontend + verify mobile print on First View tenant before client sign-off.

---

## Backdated invoices smoke (2026-07-08)

| # | Check | Owner | Cashier |
|---|-------|-------|---------|
| 1 | Sales date picker allows past date | Pass expected | Blocked (today only) |
| 2 | Past date shows reason field + warning | Pass expected | N/A |
| 3 | Create backdated sales with reason ? 201 | Pass expected | 403 expected |
| 4 | Approve backdated sale ? stock/ledger dated to invoice_date | Pass expected | N/A |
| 5 | Same for purchase invoice | Pass expected | N/A |
| 6 | Sales report for past date range includes invoice | Pass expected | N/A |
| 7 | Future date rejected | Pass expected | Pass expected |
| 8 | Approved invoice date read-only on PATCH | Pass expected | N/A |

Automated: `pytest tests/test_backdated_invoices.py` ? **14 passed** (local).

See [BACKDATED_INVOICES_POLICY.md](./BACKDATED_INVOICES_POLICY.md).

---

## Super Admin module data reset smoke (2026-07-09)

| # | Check | Expected |
|---|-------|----------|
| 1 | Danger Zone tab on company detail (Super Admin only) | Visible |
| 2 | Module catalog loads | 12 modules |
| 3 | Dry-run sales shows affected counts | Non-destructive preview |
| 4 | Purchases dry-run blocked when sales exist | `can_reset: false` + message |
| 5 | Confirm requires exact text + reason + backup checkbox | 400 if missing |
| 6 | Blocked dry-run shows `required_reset_order` + no confirm button | Pass |
| 7 | Force flags (`force`, `force_reset`, etc.) rejected | 400 |
| 8 | Confirm revalidates dependencies after dry-run | Blocked if state changed |
| 9 | Confirm deletes only target company module data | Other tenants untouched |
| 10 | History endpoint shows dry-run, blocked, and confirm audit rows | Pass |
| 11 | Tenant user cannot access reset APIs | 403 |

Automated: `pytest tests/test_admin_module_reset.py tests/test_admin_companies.py tests/test_audit.py` ? run after deploy.

See [ADMIN_MODULE_DATA_RESET.md](./ADMIN_MODULE_DATA_RESET.md).

---

## Purchase slaughter/transport deductions smoke (2026-07-09)

| # | Check | Expected |
|---|-------|----------|
| 1 | Create supplier category `slaughterhouse` + slaughterhouse supplier | Pass |
| 2 | Create supplier category `transport` + transport supplier | Pass |
| 3 | Purchase invoice draft with slaughter + transport deductions | Saved on draft |
| 4 | Approve purchase | Poultry supplier balance = net payable |
| 5 | Slaughterhouse supplier balance += slaughter deduction | Pass |
| 6 | Transport supplier balance += transport deduction | Pass |
| 7 | Inventory stock-in at gross unit cost (not net) | Pass |
| 8 | Print preview shows gross, deductions, net payable | Pass |
| 9 | Cancel approved purchase reverses all three ledgers | Pass |

Automated: `pytest tests/test_purchases.py -k deduction` ? run after deploy.

See [PURCHASE_DEDUCTIONS_SLAUGHTER_TRANSPORT.md](./PURCHASE_DEDUCTIONS_SLAUGHTER_TRANSPORT.md).

---

## Supplier payment method + purchase dropdown smoke (2026-07-09)

Tenant: `https://firstview.poultryhero.solutions` (`VITE_USE_MOCK_DATA=false`)

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 1 | Create supplier with default payment method **???? ???? / Bank** | POST 201, `default_payment_method: "bank"` | Pending manual (owner login) |
| 2 | Create slaughterhouse supplier with bank default | POST 201 | Pending manual |
| 3 | Add supplier `?????? ???? ???????` (category `Other`, active) | Appears in Suppliers list | Pending manual |
| 4 | Open Purchase Invoice ? main supplier dropdown | New supplier appears (uses `GET /api/v1/tenant/suppliers/?is_active=true`) | Pending manual |
| 5 | Refresh suppliers button (????? ????????) | Refetches list | Pending manual |
| 6 | Slaughterhouse deduction dropdown | Only `category_code=slaughterhouse` suppliers | Pending manual |
| 7 | Transport deduction dropdown | Only `category_code=transport` suppliers | Pending manual |
| 8 | Select new supplier + save draft ? refresh | Draft persists; supplier still shown | Pending manual |

Deploy prerequisites:

```bash
python manage.py migrate            # suppliers.0003 + inventory.0004
python manage.py ensure_service_supplier_categories --company-subdomain firstview
```

Automated (passed locally 2026-07-09): `pytest tests/test_suppliers.py tests/test_purchases.py` ? 83 passed; frontend typecheck + build pass.

---

## Four client blockers smoke (2026-07-10)

Tenant: `https://firstview.poultryhero.solutions` (`VITE_USE_MOCK_DATA=false`)

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 1 | Delete a line from a draft purchase invoice | Line removed, totals recalculated, no `Method "DELETE" not allowed` | Pending deploy + manual |
| 2 | Delete a line from a draft sales invoice | Same | Pending deploy + manual |
| 3 | Delete a line from an approved invoice | 400 `?? ???? ??? ??? ?? ?????? ??????` | Pending deploy + manual |
| 4 | Purchase line KG=3344.8, price/kg=14.5 | Line total = 48,499.60 (kg × price, not pieces × price) | Pending deploy + manual |
| 5 | Create backdated purchase draft with reason, then approve | Approval succeeds; stock/ledger dated by `invoice_date` | Pending deploy + manual |
| 6 | Create backdated sales draft with reason, then approve | Approval succeeds | Pending deploy + manual |
| 7 | Payment method = cash | Only active cashboxes listed (`??????`), with balances | Pending deploy + manual |
| 8 | Payment method = bank | Only active bank accounts listed (`?????? ??????`) with bank name/number/balance | Pending deploy + manual |
| 9 | Payment method = credit | Account selector hidden, paid = 0 | Pending deploy + manual |
| 10 | Payment method = partial | Source-type picker (cashbox/bank) then matching dropdown | Pending deploy + manual |
| 11 | Approve cash purchase with bank account selected (API) | 400 account-type mismatch | Covered by automated tests |

Automated (passed locally 2026-07-10): full backend suite `pytest tests` — **560 passed**; `python manage.py check` clean; frontend `typecheck` + `build` pass.

---

## 2026-07-10 — VAT duplication fix smoke (pending production deploy)

| # | Step | Expected | Status |
|---|------|----------|--------|
| 1 | Purchase invoice VAT on; line 7.5 kg × 13.75 | Line table **103.12** (ex-VAT); footer VAT **5.16**; net **108.28** | Pending deploy |
| 2 | Purchase print preview / PDF | No VAT in line Total column when footer shows VAT | Pending deploy |
| 3 | Sales invoice same line | Same ex-VAT line total; footer VAT once | Pending deploy |
| 4 | VAT disabled purchase/sales | VAT row 0 / hidden; totals = subtotal | Pending deploy |
| 5 | Purchase with slaughter/transport deductions | Net = gross incl. VAT ? deductions | Pending deploy |
| 6 | Tax report for period | `purchase_vat` / `sales_vat` match approved invoice `vat_amount` | Pending deploy |

**Local automated:** `pytest tests/test_invoice_line_pricing.py tests/test_purchases.py tests/test_sales.py` — VAT cases pass (2026-07-10).
