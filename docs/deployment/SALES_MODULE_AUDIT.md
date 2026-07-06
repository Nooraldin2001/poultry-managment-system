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

---

## Sales edit Not Found (Phase 13 — 2026-07-06)

**Issue (AR):** `تعديل فاتورة بيع` → `No Sale Invoice matches the given query.`

| Layer | Problem |
| --- | --- |
| **Routing** | Edit used `sales-new` with stale `selectedSalesId` (purchase Not Found pattern) |
| **ID mapping** | Row actions fell back to `inv.id` = `invoice_number`, not database `id` |
| **Load guard** | `docId` pre-set from bad `invoiceId` → 404 still rendered half-built edit form |
| **Detail router** | Missing invoice defaulted to `draft` status |
| **Backend** | Cancelled invoices 404 on detail because list filter applied to retrieve |

## Fix

| Area | Change |
| --- | --- |
| `App.tsx` | `sales-edit` route; `sales-new` clears ID; `SalesEditLiveRouter` + `SalesDetailLiveRouter` NotFound |
| `LiveSalesInvoiceScreen.tsx` | `notFound` state; `docId` empty until load; `NotFoundState` |
| `salesService.ts` | `getSalesDetail` throws on 404 |
| `sales/views.py` | Cancelled exclusion only on `list` action |
| List actions | Always pass `recordId` (database PK) to API |

## Status-based UX

| Status | Edit button | Screen |
| --- | --- | --- |
| `draft` | Yes → `sales-edit` | Editable `LiveSalesInvoiceScreen` |
| `approved` / `partial` / `paid` | No | `LiveDocumentReadOnly` on detail |
| `cancelled` | No | Read-only detail (retrieve by ID works) |
| Missing / wrong ID | — | `NotFoundState` (not raw DRF error) |

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/tenant/sales/` | List includes `id` + `invoice_number` |
| GET | `/api/v1/tenant/sales/{id}/` | Detail by database ID; tenant-scoped 404 |
| PATCH | `/api/v1/tenant/sales/{id}/` | Draft only |

## Tests / checks

- `pytest tests/test_sales.py` — **49 passed** (list/detail/404/tenant/patch rules)
- `pnpm run typecheck` / `build` — Pass

## Production verification

1. First View owner → Sales → Edit draft → loads without DRF error
2. Save draft → approve → open approved → read-only detail
3. Invalid/stale ID in edit route → `NotFoundState` AR/EN
4. Hard refresh on sales detail → still loads

---

## Invoice print templates (Phase 14 — 2026-07-06)

Sales print preview (`GET /api/v1/tenant/sales/{id}/print-preview/`) now returns:

- `branding` — tenant `InvoiceDesignSettings` (template key, color theme, visibility toggles)
- `company` — logo/stamp/signature URLs, TRN, bilingual names
- `party` / `customer` — `customer_trn_snapshot` first, fallback to live customer TRN
- `invoice.title_ar` / `title_en` — فاتورة ضريبية / Tax Invoice

Frontend: `LivePrintPreviewScreen` → `InvoiceTemplateRenderer` when `branding` present. Default template `firstview_style` matches official tax invoice layout (dark header, red title strip, dense table, stamp/signature footer).

See [INVOICE_BRANDING_AND_TEMPLATES.md](./INVOICE_BRANDING_AND_TEMPLATES.md).
