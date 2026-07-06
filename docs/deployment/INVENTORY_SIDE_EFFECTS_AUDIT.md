# Inventory Side Effects Audit

**Date:** 2026-07-06 (Phase 10)

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

**Classification: Case 1 + Case 2 (+ Case 3 for cartons-only lines)**

| Case | Symptom | Root cause |
|---|---|---|
| **1 — Backend** | Approved purchases, supplier balance OK, **no** stock movements/balances | `add_stock(kg=0)` when lines saved cartons-only without derived KG |
| **2 — Frontend** | DB may have balances but UI shows **0 cartons / 0 KG / AED 0** | `inventoryService.ts` mapped `total_cartons` but API returns `available_cartons` |
| **3 — Payload** | UI shows 250 KG but backend stored `quantity_kg=0` | Fixed-weight derive not applied server-side before approve (pre-Phase 9) |

Additional (Phase 9): VAT line/header mismatch; stale list after approve (fixed via `tenantRefresh`).

## Fix

### Backend (`apps/purchases/services.py`)

- `_normalize_line_quantities_for_stock()` — derive pieces/kg from cartons for fixed-weight products before approval.
- `_validate_lines_for_approval()` — reject stock-tracked lines with zero quantity; require KG > 0 for moving-weight.
- `_apply_purchase_stock_side_effects()` — idempotent stock add (delta vs already-posted movements).
- `repair_purchase_inventory_side_effects` management command — backfill approved purchases missing stock.
- `recalculate_purchase_invoice()` — when header `vat_rate=0`, force line VAT to zero and set invoice `vat_amount=0`.

### Frontend

- `LivePurchaseInvoiceScreen`: VAT toggle, persist header/line `vat_rate`, sync lines before approve.
- `inventoryService.ts`: map `available_cartons/pieces/kg`, movement `*_delta` fields.
- `shared/utils/tenantRefresh.ts` + `useListResource` refresh scopes — inventory/products/purchases/suppliers lists refetch after approve.

### VPS diagnosis & repair

```bash
python scripts/diagnose_tenant_purchase_inventory.py firstview
python manage.py repair_purchase_inventory_side_effects --company-subdomain firstview --dry-run
python manage.py repair_purchase_inventory_side_effects --company-subdomain firstview --confirm-repair
```

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
- `test_fixed_weight_50_cartons_equals_250_kg_on_approve`
- `test_repair_dry_run_does_not_add_stock`
- `test_repair_confirm_adds_missing_stock`
- `test_purchase_chicken_part_by_kg_without_cartons`
- `test_sales_chicken_part_deducts_kg_and_blocks_oversell`
- `test_cross_tenant_purchase_approval_inventory_isolated`
