# Auth / API Loop Audit — First View Tenant (2026-07-09)

Tenant: `https://firstview.poultryhero.solutions` (`VITE_USE_MOCK_DATA=false`)

## Symptoms reported

| Console / Network | Observed |
|-----------------|----------|
| `GET /api/v1/admin/companies/?page_size=100` | **403** on tenant pages |
| `GET /api/v1/tenant/purchases/?page=1&page_size=100` | **401** |
| `GET /api/v1/tenant/suppliers/2` | `net::ERR_FAILED` (often request aborted during remount) |
| UI | Aggressive refetch; supplier profile + purchase invoice unstable; lines not persisting |

## Root causes

### 1. Tenant app called Super Admin companies API

`TenantApp` and root `App` mounted `useAdminCompanies()` unconditionally. That hook always fetched `GET /api/v1/admin/companies/` on mount — forbidden (403) for tenant JWTs.

**Additional race (2026-07-09 evening):** root `App` initialized `mode` to `"superadmin"` on every host. On `firstview.poultryhero.solutions`, the first paint enabled `useAdminCompanies` **before** auth resolved and mode switched to `"tenant"`, so `/admin/companies/` still fired once per page load even after the hook `enabled` guard.

Tenant company context is already available from `GET /api/v1/auth/me/` (`user.company`). `resolveTenantCompany()` uses `briefToUiCompany(user.company)` for non–super-admin users and does **not** need the admin companies list.

### 2. No single-flight session expiry handling

On 401, `request()` attempted token refresh once per call. When refresh failed, tokens were cleared but React auth state remained until the next `/auth/me/` failure. Hooks kept firing protected API calls → repeated 401 spam and `net::ERR_FAILED` from aborted in-flight requests during navigation.

### 3. Supplier detail errors swallowed

`getSupplierRow()` caught all errors and returned `null`, so supplier profile showed an empty state instead of a proper 401/403/404/network error — masking the real failure mode.

### 4. Purchase from supplier profile did not preselect supplier

`PurchNewScreen` / `LivePurchaseInvoiceScreen` did not receive `initialSupplierId`. Navigating from supplier profile opened a blank purchase form even though `selectedSupplierId` was set in `TenantApp`.

### 5. Purchase line add used optimistic local state only

After `POST .../lines/`, the UI appended a local line without refetching the draft from the server. On 401 or partial failure, lines appeared to vanish or never persisted.

### 6. Supplier profile / detail screens stuck on infinite loading

`useDetailResource` included `mockFetcher` in the `useCallback` dependency array. Supplier profile passes an **inline** `async (id) => ...` mock fetcher on every render → `reload` identity changes every render → `useEffect([reload])` refires endlessly → perpetual `LoadingState` ("جارِ تحميل البيانات...").

`useTenantDashboard` could also refetch before auth resolved (no `isAuthenticated()` guard).

`authStore.login()` did not call `setLoading(false)` after a successful login, so `App` could keep `auth.loading === true` and block tenant content behind the global loading gate.

## Fixes applied

| Area | Change |
|------|--------|
| `useAdminCompanies` | `enabled` option; disabled for tenant sessions |
| `listCompaniesLive` | Hard block on tenant host — returns `[]` without HTTP call |
| Root `App` | `initialAppMode()` = `tenant` when host is tenant subdomain |
| Root `App` | Admin companies enabled only when `host !== tenant` AND superuser AND not loading |
| `TenantApp` | `useAdminCompanies({ enabled: isSuperAdmin && host !== tenant })` |
| `services/api/session.ts` | Single-flight `notifySessionExpired()` |
| `services/api/client.ts` | Calls `notifySessionExpired()` when refresh fails |
| `App` | Registers handler: toast AR/EN + logout + login screen once |
| `useListResource` / `useDetailResource` | Skip fetch when not authenticated (stops post-logout 401 spam) |
| `getSupplierRow` | Propagates API errors to `useSupplierDetail` |
| `LivePurchaseInvoiceScreen` | `initialSupplierId` prop; refetch lines after add; session-expired UI |
| `PurchNewScreen` / `App` | Pass `selectedSupplierId` as `initialSupplierId` |
| `useDetailResource` | Store `mockFetcher` in `useRef`; stable `reload` deps `[id, liveFetcher]` only |
| `useTenantDashboard` | Skip fetch when not authenticated; stable `dateFrom` / `dateTo` deps |
| `authStore.login` | `setLoading(false)` after successful login |

## Expected network on tenant session (after fix)

| Action | Allowed endpoints |
|--------|-------------------|
| Any tenant page | **No** `/api/v1/admin/companies/` |
| Supplier profile | `GET /api/v1/tenant/suppliers/{id}/` |
| Purchase new from profile | `GET /api/v1/tenant/suppliers/?is_active=true`, `POST /api/v1/tenant/purchases/`, `POST .../lines/` |
| Session expired | One refresh attempt → one logout redirect; no infinite loop |

## Production verification checklist

1. Login First View tenant user.
2. Open Suppliers → supplier profile → Network: **no** `/admin/companies/`.
3. Click **إنشاء فاتورة شراء** → supplier preselected.
4. Add product line → `POST .../lines/` 201 → line visible.
5. Save draft → refresh → line persists.
6. Let session expire (or revoke token) → single toast + login screen; no refetch loop.
7. Supplier profile loads without infinite spinner; Network shows one `GET .../suppliers/{id}/` per navigation.

## Unrelated console noise

`feature_collector.js:23 — using deprecated parameters for the initialization function` is **not** from Poultry Hero. It comes from a **browser extension** (e.g. Cursor, analytics, or devtools helper) injected into the page. Safe to ignore; it does not affect tenant API behavior.

## Automated checks (local 2026-07-09)

- `pnpm run typecheck` — pass
- `pnpm run build` — pass
- Backend unchanged for this fix (no new migrations)
