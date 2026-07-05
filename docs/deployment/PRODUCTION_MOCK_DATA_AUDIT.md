# Production Mock-Data Audit (Phase 4A)

**Goal:** when the frontend runs in live/production mode
(`VITE_USE_MOCK_DATA` not `true`, or `import.meta.env.PROD === true`) it must
**never** display hardcoded demo business data — only real API data or clean
empty states.

This note records where demo/mock data lived, whether it was production-visible,
and the fix applied.

---

## Root cause

The Figma-exported UI (`frontend/src/app/App.tsx`, a ~3000-line monolith) read
demo data from two places, **regardless of any flag**:

1. **The `@/data/mock` barrel** — arrays of fake companies, revenue, customers,
   suppliers, products, invoices, etc. (extracted from `App.tsx` into
   `frontend/src/data/mock/*.ts`).
2. **Inline hardcoded literals inside `App.tsx`** — KPI numbers (e.g. `value="5"`,
   `425,000`, VAT `2,975`), a settings company profile, and an invoice-template
   preview with a fake company/customer identity.

Nothing gated either source, so the deployed prototype showed fake companies,
revenue, subscriptions and dashboard numbers as if real.

## Fix model

A single source of truth now decides mock vs live:
`frontend/src/services/config.ts` → `IS_MOCK_MODE`.

* `IS_MOCK_MODE = (VITE_USE_MOCK_DATA === "true") && !import.meta.env.PROD`.
* **Forced `false` in any production build**, even if the flag is set.

Two gates consume it:

* **`data/mock/index.ts`** wraps every business array in `gate()` → real demo
  data in mock mode, **empty array** in live/production mode.
* **Inline literals in `App.tsx`** use `demoNum()` / `demoStr()` helpers → real
  sample value in mock mode, `0` / `""` (or neutral placeholder) in production.

Screens then render their existing empty states, plus new reusable
`ProductionEmptyState` / `ApiUnavailableState` components.

---

## Findings & fixes

| File | Demo/mock data found | Visibility | Fix applied |
|------|----------------------|-----------|-------------|
| `frontend/src/data/mock/company.mock.ts` | `COMPANIES` (5 fake poultry companies), `REVENUE_DATA`, `STATUS_PIE`, `PAYMENTS_DATA`, `AUDIT_LOGS`, `PLANS_DATA`, `RECENT_ACTIVITY` | Production-visible (via barrel) | Raw data kept for dev; **gated to empty** in `data/mock/index.ts`. `ALL_MODULES` (config) kept. |
| `frontend/src/data/mock/{products,customers,suppliers,sales,purchases,reports,notifications,inventory,expenses,payments,tax,users}.mock.ts` | `T_*` / `S_*` tenant demo arrays | Production-visible (via barrel) | **Gated to empty** in `data/mock/index.ts`. |
| `frontend/src/data/mock/index.ts` | Re-exported all of the above ungated (`export *`) | Production-visible | Rewritten: business arrays pass through `gate(IS_MOCK_MODE)`; empty in production. |
| `frontend/src/services/index.ts` | Statically re-exported mock service impls | Live mode would still return mock | Branches on `IS_MOCK_MODE`: live mode returns empty lists / throws `ApiUnavailableError`; never demo data. |
| `frontend/src/app/App.tsx` — Super Admin dashboard | Hardcoded KPIs `5/3/1/1/24`, money `17,800 / 14,800 / 6,900`, overdue `2`; charts/lists/activity bound to demo arrays | Production-visible | **Phase 1:** Live mode uses `useAdminCompanies()` → `GET /admin/companies/`; KPIs derived from API; revenue/activity charts empty without endpoint. |
| `frontend/src/app/ReportsModule.tsx` — Reports home KPIs | Hardcoded `AED 18,450`, `425,000`, etc. on `ReportsHomeScreen` always | Production-visible | **Fixed 2026-07-05:** Live mode fetches `GET /tenant/reports/dashboard/` for today + month; mock literals only in dev mock mode. |
| `frontend/src/app/App.tsx` — Settings company profile | Prefilled `شركة الوطنية للدواجن`, `Al Wataniyah …`, TRN `100345678901203`, address, phone | Production-visible | Wrapped in `demoStr()` → empty in production. |
| `frontend/src/app/App.tsx` — Invoice-template preview | Fake company header + bill-to `مطعم الخليج`, TRN, invoice `INV-2025-0086`, date | Production-visible | Wrapped in `demoStr()` → neutral placeholders / empty in production. |
| `frontend/src/app/App.tsx` — `CompanyDetailScreen`, `TenantApp` | `COMPANIES[0]` fallback would crash on empty list | Production crash risk | Guarded: render empty state when no company. |
| `frontend/src/services/mock/*.mock.ts` | Import raw demo arrays from `@/data/mock/<file>` | Dev-only (mock layer) | Left as-is (dev mock layer); neutralised in live mode by `services/index.ts`. |
| `frontend/src/services/api/client.ts` | JWT `request()` with refresh | n/a | **Phase 1:** Full REST client; no mock fallback on failure. |
| `frontend/src/services/authService.ts` | Live JWT auth | n/a | **Phase 1:** login/me/logout wired. |
| `frontend/src/services/adminService.ts` | Admin companies API | n/a | **Phase 1:** Super Admin dashboard + companies list. |
| `frontend/src/services/reportsService.ts` | Tenant dashboard API | n/a | **Phase 1:** Phase 10 reports dashboard endpoint. |

> Note: the raw demo literals still exist in `data/mock/*.ts` (and are therefore
> present in the JS bundle) but are **never rendered** in production because the
> gate evaluates to empty at runtime. Keeping them lets local dev keep a fully
> populated UI.

---

## Verification

* `bash scripts/check_no_production_mock_data.sh` — static guard (run on Linux/CI).
* Windows dev: PowerShell path-normalisation equivalent may flag `services/mock/` imports
  that the bash script correctly excludes; use WSL or CI for authoritative run.
* `corepack pnpm run typecheck` and `corepack pnpm run build` — pass (Phase 3).
* Backend tests — unchanged in Phase 3.

## Phase 3 production safety changes

* `TenantApp` selection state defaults cleared (`selectedCustomerId`, `selectedProductId`, `selectedSalesId`, etc. start as `""`).
* Sales/purchase/quotation live builders do not import `src/data/mock`.
* `MovementScreen` uses `listStockMovements()` only when `!IS_MOCK_MODE` (no mock row merge).
* `StocktakingScreen` uses live inventory rows when `!IS_MOCK_MODE`.
* Mock invoice preview screens (`SalesPreviewScreen`, etc.) bypassed in live mode in favour of API print-preview JSON.

## Known limitations / follow-ups

* **Phase 3 complete** for detail navigation, sales/purchase/quotation builders, product create, stocktaking apply, tax warnings, report JSON export, sales/quotation print layouts.
* Payment allocation modals and customer/supplier profile sub-tabs remain partial.
* Product edit POST and receipt/expense print layouts — Phase 4.

---

## Phase 4 update (current pass)

- Added production-safe live wiring for:
  - settings company/VAT/numbering/print-template screens
  - users list/create/suspend/reactivate
  - product edit mode (`products-edit`)
  - purchase/receipt/expense live print preview routes
  - live customer collection and supplier payment modals
- Added read-only live detail component for non-draft documents.
- `corepack pnpm run typecheck` ✅
- `corepack pnpm run build` ✅

Remaining mock cleanup still required in:
- settings audit log screen (mock-only)
- role permissions overview screen (mock-only)
- some report builder static sections in mock mode only

---

## Phase 4B update (current pass)

### Production-visible mock removed / live wired

| Area | Change |
|------|--------|
| Customer profile tabs | Live API via `useCustomerProfileTabs` — invoices, collections, statement, special prices, free products; discounts/audit show `ApiUnavailableState` in live mode |
| Supplier profile tabs | Live API via `useSupplierProfileTabs` — purchases, payments, statement, agreements/prices; deductions/audit unavailable in live mode |
| User permissions | `LiveUserPermissionsScreen` — catalog from `GET /tenant/permissions/`, overrides from `GET/PATCH /tenant/users/{id}/permissions/` |
| Customer refund | `LiveCustomerRefundScreen` → `POST /tenant/payments/customer-refunds/` + print preview |
| Supplier refund | `LiveSupplierRefundScreen` + route `payments-supplier-refund` |
| Payment cancel | `LiveCancelPaymentModal` → `cancelPaymentMovement` |
| Expense detail | `LiveExpenseDetailScreen` read-only + cancel + attachments |
| Attachments | `attachmentService` + `DocumentAttachmentsPanel` for purchase/expense |
| Tenant dashboard | Monthly KPIs use live dashboard summary; charts empty when no trend data |
| Report export | `report_type` + date filters passed to export payload |
| Daily report | Live mode shows unavailable state (no fake KPI rows) |

### Dev-only mock retained (gated by `IS_MOCK_MODE`)

- `CustomerModule` / `SupplierModule` inline `MOCK_*` arrays for local UI demos
- `PaymentsModule` mock movement rows when `IS_MOCK_MODE`
- `SettingsModule` role permissions overview, audit log samples
- `@/data/mock` barrel (gated empty in production builds)

### Checks run (Windows)

```bash
cd frontend
corepack pnpm run typecheck   # pass
corepack pnpm run build       # pass
```

- `bash scripts/check_no_production_mock_data.sh` — ✅ run on Linux VPS (2026-07-02), result: `OK: no production mock-data hazards found.`

---

## Phase 4C update — First View production blockers (2026-07-04)

### Root causes

| Blocker | Root cause | Source |
|---------|------------|--------|
| Add Customer does nothing | `CreateCustomerScreen` never called `POST /api/v1/tenant/customers/` — toast-only fake success | Frontend UI bug |
| Reports show demo data | `ReportsModule.tsx` always rendered hardcoded `R_*` sample arrays; dashboard listed `T_*` mock rows in live mode | **Frontend mock fallback** (not DB) |

### Fixes applied

| File | Change |
|------|--------|
| `frontend/src/app/CustomerModule.tsx` | `handleSave` → `createCustomer()` with loading, validation, list refetch |
| `frontend/src/features/reports/reportLiveData.ts` | Live/mock helpers, mappers, `EMPTY_REPORT_MSG` |
| `frontend/src/app/ReportsModule.tsx` | All report screens: API data or empty state in live mode |
| `frontend/src/app/PaymentsModule.tsx` | Payments report from `getPaymentsReport()` |
| `frontend/src/app/App.tsx` | Tenant dashboard mock lists gated; empty states in live mode |
| `backend/apps/core/management/commands/purge_tenant_demo_data.py` | Scoped demo purge (dry-run default) |
| `backend/apps/core/management/commands/reset_tenant_operational_data.py` | Dangerous full ops reset (confirm required) |

### Production rule enforced

In live mode (`VITE_USE_MOCK_DATA=false`, prod build):

- API success with data → show real data
- API success with empty → show “No real data yet” / zero KPIs
- API failure → `ErrorState` / `ApiUnavailableState` / `PermissionDeniedState`
- **Never** merge or fallback to mock report rows

### Checks (local, 2026-07-04)

```bash
cd frontend && corepack pnpm run typecheck && corepack pnpm run build  # pass
cd backend && python manage.py check && python -m pytest tests/test_customers.py tests/test_tenant_demo_commands.py tests/test_reports.py  # 50 passed
bash scripts/check_no_production_mock_data.sh  # OK
```

### VPS cleanup (not yet executed)

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --dry-run
# Review output; only if demo-pattern rows:
python manage.py purge_tenant_demo_data --company-subdomain firstview --confirm-delete-demo-data
```

---

## Production bundle audit (2026-07-04 evening)

Deployed asset: `index-dMIyB4tH.js` at commit **`ded78f1`** (customer fix only).

| String / indicator | Count in prod bundle | Meaning |
|--------------------|---------------------:|---------|
| `tenant/customers` | 6 | Customer live API wired in deployed build |
| `مطعم الخليج` | 19 | Demo report strings still present — reports fix **not deployed** |
| `WESTLAND` | 18 | Same |
| `No real data yet` | 1 | Partial empty-state copy |
| Reports fix runtime helpers | 0 | Local `reportLiveData.ts` changes not on VPS |

**Conclusion:** Demo report data source on current production is **frontend mock fallback** in the pre-fix reports bundle. DB purge not assessed (dry-run not run).

---

## Production bundle audit (2026-07-05)

Deployed asset: **`index-DLgOG8Hc.js`** on First View (includes `bff86fe` + `c7d747a`).

| String / indicator | Count | Meaning |
|--------------------|------:|---------|
| `tenant/customers` | 6 | Customer live API |
| `tenant/products` | 2 | Product live API |
| `WESTLAND` | 14 | Mock literals in bundle — runtime gated by `IS_MOCK_MODE=false` |
| `liveOrMockRows` | In source | Live mode returns API rows or `[]` — no mock merge |

### Tenant create workflows — code status

| Module | Fix | Prod verified? |
|--------|-----|----------------|
| Customer | `ded78f1` | Pending |
| Product + categories | `c7d747a` | Pending |
| Supplier | `c7d747a` | Pending |
| Sales / purchase invoices | `c7d747a` | Pending |
| Reports demo fallback | `bff86fe` | Pending UI smoke |

If client still sees demo names after deploy, run `purge_tenant_demo_data --company-subdomain firstview --dry-run` on VPS.
