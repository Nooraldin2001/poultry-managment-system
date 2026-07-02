# Phase 1 — Frontend API Integration Notes

Implementation notes for connecting Poultry Hero frontend to the Django REST backend (auth, tenant context, dashboards).

---

## API client changes

**Files:** `frontend/src/services/api/client.ts`, `types.ts`, `errors.ts`, `endpoints.ts`

- `request<T>(path, { method, body, query, auth, noRefresh })` builds URLs as `{VITE_API_BASE}/v1{path}`.
- JSON request/response; `Content-Type: application/json` unless body is `FormData`.
- `ApiError` carries HTTP status, human message, and DRF `fieldErrors`.
- `PaginatedResponse<T>` type for `{ count, next, previous, results }`.
- Token refresh on 401 via `POST /auth/refresh/` (single-flight deduped).
- `clearTokens()` exported for logout and failed refresh.

**Endpoint constants** (`endpoints.ts`):

| Key | Path |
|-----|------|
| `auth.login` | `/auth/login/` |
| `auth.refresh` | `/auth/refresh/` |
| `auth.logout` | `/auth/logout/` |
| `auth.me` | `/auth/me/` |
| `admin.companies` | `/admin/companies/` |
| `admin.plans` | `/admin/plans/` |
| `admin.subscriptionPayments` | `/admin/subscription-payments/` |
| `tenant.reportsDashboard` | `/tenant/reports/dashboard/` |

---

## Auth integration

**Files:** `authService.ts`, `state/authStore.tsx`, `hooks/useAuth.ts`

1. Login: `POST /auth/login/` with `{ email, password }` → stores `access` + `refresh`, returns `user`.
2. Startup: if access token exists, `GET /auth/me/` loads `CurrentUser`.
3. Logout: `POST /auth/logout/` (best-effort) + `clearTokens()` + clear context.
4. Route guards in `App.tsx`: unauthenticated users see `LoginScreen`; authenticated users routed by `is_superuser`.
5. Invalid credentials: `ApiError` message shown on login form.
6. Expired session: refresh attempt; on failure tokens cleared and user sent to login.

**Mock mode (`VITE_USE_MOCK_DATA=true`, dev only):** login accepts any credentials and sets a fake superuser — never in production builds.

---

## Tenant context behavior

**Files:** `tenantService.ts`, `hooks/useTenant.ts`

- Tenant is determined from JWT user payload (`GET /auth/me/`):
  - `user.company` → `CompanyContext` (id, bilingual names, subdomain, status)
  - `user.role` → UI role via `mapBackendRole()` (`owner_admin` → `owner`, `accountant`, `cashier_sales` → `cashier`)
- No hardcoded company ID or subdomain.
- Super admin entering a tenant uses `resolveTenantCompany(user, companyId, adminCompanies)` with live admin company list.
- Backend scopes tenant APIs from the authenticated user; no extra tenant header required.

---

## Super Admin live data behavior

**Files:** `adminService.ts`, `hooks/useAdminCompanies.ts`, `DashboardScreen`, `CompaniesScreen`

- `listCompanies()` → `GET /api/v1/admin/companies/` (paginated; mapped to UI `Company` type).
- Dashboard KPIs computed client-side from company list (`buildAdminDashboardSummary`).
- Status pie chart from real company status counts.
- Revenue/activity charts: empty in live mode (no dedicated admin analytics endpoint yet).
- **Empty list:** Arabic `لم يتم إنشاء أي شركات بعد` / English `No companies created yet`.
- Loading: `LoadingState`; errors: `ErrorState` with retry.

`listPlans()` / `listSubscriptionPayments()` implemented in `adminService.ts` but not yet bound to UI screens (Phase 2).

---

## Tenant dashboard live data behavior

**Files:** `reportsService.ts`, `hooks/useTenantDashboard.ts`, `TenantDashboardScreen`

- `getTenantDashboardSummary({ date_from, date_to })` → `GET /api/v1/tenant/reports/dashboard/`.
- KPI cards bind to API fields: `total_sales`, `total_purchases`, `gross_profit`, `net_profit_foundation`, `total_expenses`, `customer_receivables`, `supplier_payables`, `inventory_value`, `inventory_kg`, `low_stock_count`, `quotations_open_count`, `tax_net_vat_estimate`.
- Sales trend chart uses `sales_trend[]` from API.
- Date filter (`today` / `yesterday` / `week` / `month`) maps to query params via `dashboardDateRange()`.
- Mock-only sections (payment pie, overdue customer banner, role switcher) gated behind `IS_MOCK_MODE`.
- Empty tenant: zeros and empty charts, not fake numbers.

---

## Mock mode behavior

| Condition | Behavior |
|-----------|----------|
| `VITE_USE_MOCK_DATA=true` + `vite dev` | Full demo UI from gated mock barrel; mock login |
| `VITE_USE_MOCK_DATA=false` or unset | Live API mode |
| `vite build` (`import.meta.env.PROD`) | `IS_MOCK_MODE` forced `false` regardless of env |

Services never silently substitute mock data when an API call fails in live mode.

---

## Environment variables

```env
# Development (.env.development.example)
VITE_API_BASE=http://localhost:8000/api
VITE_USE_MOCK_DATA=true

# Production (.env.production.example)
VITE_API_BASE=https://poultryhero.solutions/api
VITE_USE_MOCK_DATA=false
```

Copy examples to `.env.development` / `.env.production` locally; never commit real secrets.

---

## Loading / error / empty states

**File:** `shared/components/ApiStates.tsx`

| Component | Arabic | English |
|-----------|--------|---------|
| `LoadingState` | جارٍ تحميل البيانات... | Loading data... |
| `EmptyState` | لا توجد بيانات فعلية بعد | No real data yet |
| `ErrorState` | تعذر تحميل البيانات من الخادم | Unable to load data from server |
| `PermissionDeniedState` | ليس لديك صلاحية للوصول إلى هذه البيانات | You do not have permission to access this data |

Used on Super Admin dashboard, companies list, and tenant dashboard.

---

## Production data safety

- `IS_MOCK_MODE` single gate in `services/config.ts`.
- `data/mock/index.ts` returns empty arrays in live/production.
- `demoNum` / `demoStr` helpers zero out inline literals in live mode.
- `scripts/check_no_production_mock_data.sh` — bash guard (run on CI/Linux).
- On Windows, PowerShell equivalent static grep was run during Phase 1 verification.

---

## Commands run

```bash
cd frontend
corepack pnpm run typecheck   # pass
corepack pnpm run build       # pass
```

```powershell
# Windows equivalent of check_no_production_mock_data.sh — pass
```

`bash scripts/check_no_production_mock_data.sh` — **not run** (bash unavailable on Windows dev shell; use CI or WSL).

Backend tests not run (no backend changes).

---

## Known limitations

1. **Monolithic `App.tsx`** — most ERP screens still use gated mock data or empty service stubs.
2. **Super Admin** — plans, payments, audit, company detail not yet on live APIs.
3. **No React Router** — navigation is internal state; deep links not supported.
4. **Token storage** — `localStorage` (existing project pattern); consider httpOnly cookies in a future security pass.
5. **Admin revenue chart / recent activity** — no backend endpoint; shows empty in live mode.
6. **Tenant role switcher** — dev mock only; production uses JWT role.
7. **`getDashboardSummary`** removed from `services/index.ts` (incompatible mock shape); use `getTenantDashboardSummary` from `reportsService`.

---

## Next recommended phase

**Phase 2:** Connect Products, Customers, Suppliers, Inventory, Purchases, Sales, Payments, Quotations, Expenses, Tax, and Reports list/detail screens to live APIs using shared CRUD patterns.

Suggested prompt:

> Implement Frontend API Integration Phase 2 with Products, Customers, Suppliers, Inventory, Purchases, Sales, Payments, Quotations, Expenses, Tax, and Reports list/detail screens connected to live APIs using shared CRUD patterns.
