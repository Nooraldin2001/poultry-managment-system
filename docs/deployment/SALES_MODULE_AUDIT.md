# Sales Module Audit — White Screen Fix

- **Date (UTC):** 2026-07-05
- **Tenant:** `firstview` — `https://firstview.poultryhero.solutions`
- **Issue (AR):** `المبيعات بقت صفحة بيضة بس` — Sales page blank white screen (mobile Safari reported)

## Root cause

| Layer | Problem |
| --- | --- |
| **Status mapping** | Backend returns `status: "partially_paid"`; UI `SInvStatusBadge` only mapped `partial` → `cfg` undefined → **render crash** (`Cannot read properties of undefined (reading 'bg')`) |
| **Error boundary** | No route-level error boundary — React render throw blanked content area |
| **Cache (mobile)** | Stale `index.html` could reference old hashed JS chunks after deploy (mitigated in nginx config) |

## Fix

| Area | Change |
| --- | --- |
| `invoiceStatus.ts` | `normalizeSalesInvoiceStatus()` maps `partially_paid` → `partial` |
| `salesService.ts` | `mapApiSalesToRow()` normalizes status at API boundary |
| `App.tsx` | `SInvStatusBadge` defensive fallback; list uses normalized status + safe `(saleRows ?? [])` |
| `ModuleErrorBoundary` | Wraps all `sales-*` routes with AR/EN error card + Retry / Back |
| `createCrudService.ts` | Safe `results` array when paginated response malformed |
| Nginx | `index.html` no-cache; `/assets/` immutable long cache |

## Expected console error (before fix)

```text
TypeError: Cannot read properties of undefined (reading 'bg')
  at SInvStatusBadge (App.tsx)
```

Triggered when any sales invoice has `status: "partially_paid"`.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/tenant/sales/` | List; status values include `partially_paid` |
| GET | `/api/v1/tenant/sales/{id}/` | Detail |

## UI states (Sales list)

| State | Component |
| --- | --- |
| Loading | `LoadingState` |
| Empty | Empty card + New Invoice button |
| 403 | `PermissionDeniedState` |
| API/network error | `ErrorState` + Retry |
| Render throw | `ModuleErrorBoundary` card |

## Tests / checks

- `pnpm run typecheck` — Pass
- `pnpm run build` — Pass
- Backend sales tests unchanged (no backend change)

## Production verification

1. Login First View owner → Sales → list renders (no white screen)
2. If any partially-paid invoice exists → status badge shows "Partial" / "مدفوعة جزئياً"
3. Mobile Safari → scroll list, tap New Invoice
4. Hard refresh / incognito → no blank screen
5. DevTools → no JS chunk 404 on `/assets/index-*.js`

---

## Invoice branding & customer TRN (Phase 12)

| Item | Detail |
| --- | --- |
| Snapshots | `customer_name_snapshot`, `customer_trn_snapshot`, `customer_phone_snapshot`, `customer_address_snapshot` |
| Create | Copies current customer data |
| Draft PATCH | Re-select customer → snapshots update |
| Approve | Snapshots refreshed once, then frozen |
| Print preview | `GET .../print-preview/` → `customer.trn` from snapshot; legacy fallback if empty |
| UI | `PrintPreviewLayout` shows Customer TRN / الرقم الضريبي للعميل |

Tests: `tests/test_invoice_branding.py` — snapshot storage, print preview company + customer TRN, approve refresh.

See [INVOICE_BRANDING_AND_TAX_IDENTITY.md](./INVOICE_BRANDING_AND_TAX_IDENTITY.md).
