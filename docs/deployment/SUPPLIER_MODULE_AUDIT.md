# Supplier Module Audit — First View Production Fix

- **Date (UTC):** 2026-07-05
- **Issue:** `تعديل الموردين مش شغال` — supplier edit did not work

## Root cause

| Layer | Problem |
| --- | --- |
| Routing | No `suppliers-edit` screen; edit buttons navigated to `suppliers-new` |
| Form | `CreateSupplierScreen` always POSTed create; never PATCH update |
| Service | No `getSupplierDetail()` or `buildSupplierUpdatePayload()` |
| Permissions | UI used role heuristic only |

Backend `PATCH /api/v1/tenant/suppliers/{id}/` existed with `suppliers.edit`.

## Fix

| Area | Change |
| --- | --- |
| Route | `suppliers-edit` (mirrors `customers-edit`) |
| List / profile | **تعديل** / **Edit Supplier** → `suppliers-edit` with selected ID |
| Form | Edit mode: GET prefill, PATCH save via `buildSupplierUpdatePayload()` |
| Opening balance | Excluded from PATCH (dedicated endpoint when implemented) |
| Permissions | `canEditSupplier()` / `canCreateSupplier()` |

## API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/tenant/suppliers/{id}/` | `suppliers.view` |
| PATCH | `/api/v1/tenant/suppliers/{id}/` | `suppliers.edit` |

## Tests

- `backend/tests/test_suppliers.py` — included in targeted run (**96 passed** with purchases/products/inventory)
- Frontend: `pnpm run typecheck`, `pnpm run build`

## Production smoke (First View admin)

1. Suppliers → row edit or profile **تعديل بيانات المورد** → form prefilled
2. Change phone/email/notes → save → PATCH 200
3. Refresh → values persist

---

# Update 2026-07-09 — Supplier dropdown rules + payment method enum

## Issue 1: `'bank' is not a valid choice` on supplier create

- **Root cause:** frontend sent `default_payment_method: "bank"` but the backend `PaymentMethod` enum only had `cash / bank_transfer / cheque / other`.
- **Fix:** enum now includes canonical `cash / bank / credit` (legacy values kept); serializer normalizes aliases (`bank_transfer` → `bank`, `deferred` → `credit`); migration `suppliers.0003_alter_supplier_default_payment_method`.
- Frontend dropdown options are exactly `cash / bank / credit` (`shared/utils/supplierPaymentMethod.ts`).

## Issue 2: new supplier missing from purchase invoice supplier dropdown

- **Symptom:** supplier (e.g. `شركة نصر`) shows in Suppliers list but not in the purchase invoice supplier selector.
- **Dropdown rules (final):**
  - Main purchase supplier dropdown → `listPurchaseSuppliers()` → `GET /api/v1/tenant/suppliers/?is_active=true` (paginated, all pages via `listAll`), then client-side exclusion of only `category_code ∈ {slaughterhouse, transport}`. Suppliers with category `other` or no category are always included.
  - Slaughterhouse deduction dropdown → `GET /api/v1/tenant/suppliers/?category_code=slaughterhouse&is_active=true`
  - Transport deduction dropdown → `GET /api/v1/tenant/suppliers/?category_code=transport&is_active=true`
- **Freshness:** `createSupplier()` / `updateSupplier()` now emit `notifyTenantDataChanged("suppliers")`; the purchase screen supplier list subscribes to that scope and refetches. A manual **تحديث الموردين / Refresh suppliers** button was added next to the dropdown, plus loading and `لا يوجد موردين متاحين / No suppliers available` empty states.
- **List API contract:** `SupplierListSerializer` now also returns `default_payment_method` (already returned `id`, `name_ar`, `name_en`, `category`, `category_code`, `current_balance`, `is_active`).
- **Pagination:** frontend `crud.listAll()` follows `next` with `page_size=100`; both array and `{results}` shapes handled.
- No mock supplier fallback in live mode (`P_SUPPLIERS` only renders when `IS_MOCK_MODE=true`).

## Tests (2026-07-09)

- `pytest tests/test_suppliers.py tests/test_purchases.py` — **83 passed** (new: list visibility, `other` category inclusion, exclusive category_code filters, inactive exclusion, tenant isolation on list, bank payment method suite)
- `pnpm run typecheck` + `pnpm run build` — pass
