# Customer Module Audit

- **Date (UTC):** 2026-07-05
- **Issue:** `التعديل ع العميل مش موجود` — no live customer edit flow

## Root cause

| Layer | Problem |
| --- | --- |
| Frontend routing | List/profile edit buttons navigated to `customers-create` without `customerId` |
| Create screen | Always called `createCustomer` POST; never `updateCustomer` PATCH |
| Service | `updateCustomer` and `getCustomerDetail` existed or were added but unused |
| Permissions | UI used role heuristic; backend uses `customers.edit` |

Backend `PATCH /api/v1/tenant/customers/{id}/` was already implemented with `customers.edit` permission.

## Fix

| Area | Change |
| --- | --- |
| Route | `customers-edit` screen (mirrors `products-edit`) |
| List | **تعديل** / **Edit** row action → `customers-edit` |
| Profile | **تعديل بيانات العميل** / **Edit Customer** button |
| Form | `CreateCustomerScreen` supports `customerId` edit mode: prefill via GET, save via PATCH |
| Payload | `buildCustomerUpdatePayload()` — excludes opening balance (dedicated endpoint) |
| Permissions | `canEditCustomer()` / `canCreateCustomer()` with `customers.edit` / `customers.create` |

## API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/tenant/customers/{id}/` | `customers.view` |
| PATCH | `/api/v1/tenant/customers/{id}/` | `customers.edit` |
| POST | `/api/v1/tenant/customers/{id}/opening-balance/` | `customers.edit_opening_balance` |

PATCH editable fields: name, phone, email, address, emirate, TRN, type, category, credit limit, payment terms, credit flags, notes.

Not editable via PATCH: `company`, `current_balance`, `opening_balance` (after create).

## Tests

- `backend/tests/test_customers.py` — 20 passed (includes PATCH, opening balance guard, cashier 403, cross-tenant 404)
- Frontend: `pnpm run typecheck`, `pnpm run build`

## Opening balance edit (Phase 5)

**Issue:** `تعديل الرصيد الافتتاحي بتاع العميل` — no UI wired to backend.

**Policy:**
- PATCH customer profile **cannot** change opening balance (backend validation).
- Use `POST /api/v1/tenant/customers/{id}/opening-balance/` with `opening_balance`, `opening_balance_type`, `reason`.
- Backend creates correcting `opening_balance` ledger entry for the delta; audit log records reason.
- If customer has invoices/collections/ledger activity: profile shows read-only opening balance + **Add Balance Adjustment** (same endpoint, adjustment copy).

**Frontend:** `OpeningBalanceModal` on customer profile; `updateCustomerOpeningBalance()`; `canEditCustomerOpeningBalance()`.

## Production smoke (First View admin)

1. Customers → row **تعديل** → form prefilled → change phone → save → toast **تم تحديث بيانات العميل بنجاح**
2. Profile → **تعديل بيانات العميل** → same flow → profile shows updated data
3. Refresh browser → data persists
4. Cashier: edit hidden / 403 on direct route
5. Profile → **تعديل الرصيد الافتتاحي** (no transactions) or **إضافة تسوية رصيد** (with transactions) → reason required → POST opening-balance → statement shows adjustment
