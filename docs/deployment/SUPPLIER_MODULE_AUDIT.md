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
