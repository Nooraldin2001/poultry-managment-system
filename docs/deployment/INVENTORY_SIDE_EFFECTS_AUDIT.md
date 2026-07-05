# Inventory Side Effects Audit

**Date:** 2026-07-05 (updated Phase 9)

## Business rules (backend — verified)

| Action | Expected | Backend |
|---|---|---|
| Purchase draft | No stock change | Pass — `tests/test_purchases.py` |
| Purchase approve | `add_stock`, FIFO layer, movement, supplier ledger | Pass — `approve_purchase_invoice` |
| Purchase approve (no VAT) | Same inventory side effects; `vat_amount=0` | Pass — Phase 9 tests |
| Sales draft | No stock change | Pass |
| Sales approve | FIFO consume, movement, customer ledger; block oversell | Pass — `tests/test_sales.py` |
| Double approve | Idempotent (no double add/deduct) | Pass |

## Root cause — client “inventory not updating” (First View)

1. **Frontend line VAT mismatch:** New purchase lines were saved with `vat_rate: 5` even when VAT was disabled, causing confusing totals (not blocking stock directly).
2. **Missing KG on approve:** Fixed-weight lines entered as cartons-only could be stored with `quantity_kg=0`. Approval called `add_stock` with `kg=0`, so **KG balance did not increase** (cartons might increase but UI shows KG).
3. **Stale UI:** Purchase approve did not trigger inventory list refetch; user saw old stock until full navigation/logout.

## Fix

### Backend (`apps/purchases/services.py`)

- `_normalize_line_quantities_for_stock()` — derive pieces/kg from cartons for fixed-weight products before approval.
- `_validate_lines_for_approval()` — reject stock-tracked lines with zero quantity; require KG > 0 for moving-weight.
- `recalculate_purchase_invoice()` — when header `vat_rate=0`, force line VAT to zero and set invoice `vat_amount=0`.

### Frontend

- `LivePurchaseInvoiceScreen`: VAT toggle, persist header/line `vat_rate`, sync lines before approve.
- `shared/utils/tenantRefresh.ts` + `useListResource` refresh scopes — inventory/products/purchases/suppliers lists refetch after approve.

## API endpoints

- `POST /api/v1/tenant/purchases/{id}/approve/` body `{ "reason": "..." }`
- `POST /api/v1/tenant/sales/{id}/approve/` body `{ "reason": "..." }` (+ optional `credit_override`)

## Verification (post-deploy on First View)

1. Note inventory KG for product X.
2. Create purchase draft **without VAT**, add line (10 cartons or valid KG), save draft → inventory unchanged.
3. Approve with reason → inventory KG increases; stock movement `PURCHASE_APPROVED` exists; supplier balance updated.
4. Tax report → input VAT = 0 for that purchase.
5. Refresh browser → stock remains correct (list auto-refreshed).

## Tests

- `test_approve_no_vat_increases_inventory`
- `test_approve_cartons_only_fixed_weight_derives_kg`
- `test_cross_tenant_purchase_approval_inventory_isolated`
