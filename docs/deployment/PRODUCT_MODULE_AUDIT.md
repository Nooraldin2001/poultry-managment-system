# Product Module Audit — First View Production Fix

- **Date (UTC):** 2026-07-05
- **Issue:** `تعديل المنتجات مش بتتعدل` — product edit did not persist

## Root cause

| Layer | Problem |
| --- | --- |
| Backend | `PATCH` requires `reason` when price, weight, or pieces-per-carton change |
| Frontend payload | Edit sent full create payload (including UI-only fields) without `reason` → **400** |
| Form hydration | Zero prices and min carton/kg fields not loaded from API |
| UX | Success could appear before confirming API response on some paths |

## Fix

| Area | Change |
| --- | --- |
| Service | `buildProductUpdatePayload()`, `productFormNeedsReason()`, `ProductFormSnapshot` diff |
| ProductModule | Edit mode uses PATCH payload; `ReasonModal` when price/carton fields change |
| Hydration | Load `minCt`, `minKg`, zero prices, category, product type from GET detail |
| Refresh | Refetch list/detail after successful save |

## API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/tenant/products/{id}/` | `products.view` |
| PATCH | `/api/v1/tenant/products/{id}/` | `products.edit` |

Sensitive PATCH fields require `reason` in body: default sale/purchase prices, weight, pieces per carton.

## Tests

- `backend/tests/test_products.py` — update saves price/weight/PPC; tenant isolation; invoice lines unchanged after product price change
- Frontend: `pnpm run typecheck`, `pnpm run build`

## Production smoke (First View admin)

1. Products → edit row → change price/weight/PPC → save → **PATCH 200**
2. If price/carton changed → reason modal required
3. Refresh → values persist
4. Existing invoice lines unchanged; new invoices use updated default prices
