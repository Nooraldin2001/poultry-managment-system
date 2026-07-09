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

Tenant company context is already available from `GET /api/v1/auth/me/` (`user.company`). `resolveTenantCompany()` uses `briefToUiCompany(user.company)` for non–super-admin users and does **not** need the admin companies list.

### 2. No single-flight session expiry handling

On 401, `request()` attempted token refresh once per call. When refresh failed, tokens were cleared but React auth state remained until the next `/auth/me/` failure. Hooks kept firing protected API calls → repeated 401 spam and `net::ERR_FAILED` from aborted in-flight requests during navigation.

### 3. Supplier detail errors swallowed

`getSupplierRow()` caught all errors and returned `null`, so supplier profile showed an empty state instead of a proper 401/403/404/network error — masking the real failure mode.

### 4. Purchase from supplier profile did not preselect supplier

`PurchNewScreen` / `LivePurchaseInvoiceScreen` did not receive `initialSupplierId`. Navigating from supplier profile opened a blank purchase form even though `selectedSupplierId` was set in `TenantApp`.

### 5. Purchase line add used optimistic local state only

After `POST .../lines/`, the UI appended a local line without refetching the draft from the server. On 401 or partial failure, lines appeared to vanish or never persisted.

## Fixes applied

| Area | Change |
|------|--------|
| `useAdminCompanies` | `enabled` option; disabled for tenant sessions |
| `TenantApp` | `useAdminCompanies({ enabled: isSuperAdmin })` only |
| Root `App` | `useAdminCompanies({ enabled: mode === "superadmin" })` |
| `services/api/session.ts` | Single-flight `notifySessionExpired()` |
| `services/api/client.ts` | Calls `notifySessionExpired()` when refresh fails |
| `App` | Registers handler: toast AR/EN + logout + login screen once |
| `useListResource` / `useDetailResource` | Skip fetch when not authenticated (stops post-logout 401 spam) |
| `getSupplierRow` | Propagates API errors to `useSupplierDetail` |
| `LivePurchaseInvoiceScreen` | `initialSupplierId` prop; refetch lines after add; session-expired UI |
| `PurchNewScreen` / `App` | Pass `selectedSupplierId` as `initialSupplierId` |

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

## Automated checks (local 2026-07-09)

- `pnpm run typecheck` — pass
- `pnpm run build` — pass
- Backend unchanged for this fix (no new migrations)
