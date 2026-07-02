# Phase 1 — Frontend API Integration Audit

**Date:** 2026-07-01  
**Scope:** Authentication, tenant context, Super Admin dashboard, tenant dashboard, shared API foundation, production mock safety.

---

## Current frontend structure

| Area | Location | Notes |
|------|----------|-------|
| App shell | `frontend/src/app/App.tsx` | Monolithic UI (~3000 lines); login, super-admin screens, tenant ERP shell |
| Entry | `frontend/src/main.tsx` | Wraps `<App />` in `<AuthProvider>` |
| Routing | In-app state (`mode`, `screen`, `tenantCompanyId`) — no React Router yet |
| Service boundary | `frontend/src/services/index.ts` | Screens should import data accessors here |
| API client | `frontend/src/services/api/{client,types,errors,endpoints}.ts` | JWT-aware `request()` wrapper |
| Auth state | `frontend/src/state/authStore.tsx` | React context; `useAuth` hook |
| Tenant context | `frontend/src/hooks/useTenant.ts` + `tenantService.ts` | Derived from JWT `/auth/me/` |
| Mock data | `frontend/src/data/mock/*.ts` + gated barrel `index.ts` | Dev-only when `IS_MOCK_MODE` |
| Shared UI states | `frontend/src/shared/components/ApiStates.tsx` | Loading / error / empty / permission |

---

## API client behavior (after Phase 1)

- **Base URL:** `VITE_API_BASE` (e.g. `http://localhost:8000/api` → requests go to `{base}/v1{path}`).
- **Mock flag:** `IS_MOCK_MODE` from `services/config.ts` — `VITE_USE_MOCK_DATA=true` **and** not a production build.
- **Tokens:** `localStorage` keys `poultry_hero_access_token` / `poultry_hero_refresh_token`.
- **Methods:** GET, POST, PATCH, DELETE via central `request<T>()`.
- **Auth:** Attaches `Authorization: Bearer` unless `auth: false`.
- **401:** Attempts token refresh once; on failure clears tokens.
- **403 / 404 / validation:** Mapped to typed `ApiError` with `status`, `message`, `fieldErrors`.
- **Network:** Surfaces as `ApiError` with status `0`.
- **No silent mock fallback** in production when API fails.

---

## Auth screen locations

| Screen | File | Integration |
|--------|------|-------------|
| Login | `App.tsx` → `LoginScreen` | Calls `useAuth().login(email, password)`; shows `ApiError` via toast |
| Session restore | `authStore.tsx` `useEffect` | `GET /api/v1/auth/me/` on startup when token present |
| Logout | Sidebar + handlers | `authService.logout()` + clears context |

**Role routing after login:**
- `is_superuser` → Super Admin mode (`mode: "super"`)
- Tenant user with `company` → Tenant mode (`mode: "tenant"`, company id from JWT)

Mock login (fake superuser, no API) exists **only** when `IS_MOCK_MODE === true`.

---

## Dashboard screen locations

| Screen | Component | Live data source |
|--------|-----------|------------------|
| Super Admin dashboard | `DashboardScreen` | `useAdminCompanies()` → `GET /api/v1/admin/companies/`; KPIs via `buildAdminDashboardSummary()` |
| Super Admin companies list | `CompaniesScreen` | Same hook |
| Tenant dashboard | `TenantDashboardScreen` | `useTenantDashboard()` → `GET /api/v1/tenant/reports/dashboard/` |

---

## Direct mock imports found

### Allowed (gated / mock layer)

- `frontend/src/services/mock/*.ts` — import `@/data/mock/<file>` (dev mock implementations).
- `frontend/src/data/mock/index.ts` — gates all business arrays with `IS_MOCK_MODE`.
- `frontend/src/hooks/useAdminCompanies.ts` — uses `COMPANIES` from gated barrel **only in mock mode**.
- `frontend/src/app/App.tsx` — imports gated barrel `@/data/mock` for mock-mode charts/lists.

### Not yet wired to live APIs (Phase 2+)

These screens still read gated mock arrays or `demoNum`/`demoStr` placeholders:

- `CompanyDetailScreen`, `PaymentsScreen`, `PlansScreen`, `OutstandingScreen`, `AuditLogScreen`
- Tenant sub-modules (sales, purchases, inventory, etc.) — service boundary returns empty lists in live mode

---

## Production-visible hardcoded data risks

| Risk | Mitigation |
|------|------------|
| Gated mock arrays rendered as real | `data/mock/index.ts` returns `[]` when `!IS_MOCK_MODE` |
| Inline KPI literals in `App.tsx` | `demoNum()` / `demoStr()` → `0` / `""` in live mode |
| Mock login in production | `authStore` only fakes login when `IS_MOCK_MODE` |
| API failure → mock fallback | Services set empty state or throw; **never** fall back to mock |
| Super Admin dashboard fake revenue | Live mode uses API companies only; charts empty without data |
| Tenant dashboard fake financials | Live mode uses Phase 10 `DashboardSummary`; mock sections gated with `IS_MOCK_MODE` |

**Residual (acceptable Phase 1):** Settings/invoice template preview fields use `demoStr()` — show empty in production until settings API is wired.

---

## Integration changes applied (Phase 1)

### New files

- `services/api/errors.ts`, `endpoints.ts`
- `services/authService.ts`, `adminService.ts`, `reportsService.ts`, `tenantService.ts`
- `state/authStore.tsx`
- `hooks/useAuth.ts`, `useTenant.ts`, `useAdminCompanies.ts`, `useTenantDashboard.ts`
- `shared/types/auth.ts`, `shared/types/reports.ts`
- `shared/components/ApiStates.tsx`

### Updated files

- `services/api/client.ts` — full JWT client with refresh
- `services/api/types.ts` — `PaginatedResponse`, `SelectOption`
- `services/index.ts` — live `listCompanies` / `getCompanyById`; other modules stubbed empty/unavailable
- `main.tsx` — `AuthProvider`
- `app/App.tsx` — auth guards, live dashboards, shared states

### Environment

- `frontend/.env.development.example` — `VITE_API_BASE=http://localhost:8000/api`, `VITE_USE_MOCK_DATA=true`
- `frontend/.env.production.example` — `VITE_API_BASE=https://poultryhero.solutions/api`, `VITE_USE_MOCK_DATA=false`

---

## Verification commands

| Check | Result |
|-------|--------|
| `corepack pnpm run typecheck` | Pass |
| `corepack pnpm run build` | Pass |
| `bash scripts/check_no_production_mock_data.sh` | Skipped (Windows — PowerShell equivalent run) |
| PowerShell static mock check | Pass |

Backend was **not** modified in Phase 1; backend tests not re-run.
