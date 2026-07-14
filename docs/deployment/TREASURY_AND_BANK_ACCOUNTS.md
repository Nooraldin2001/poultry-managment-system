# Treasury and Bank Accounts

## Overview

Implemented tenant-scoped treasury with real balances (no frontend-only values).

## Models

### `MoneyAccount` (`apps.payments.models`)
- `company`, `name`, `account_type` (`cashbox|bank`)
- `bank_name`, `account_number`, `iban`
- `currency` (default `AED`)
- `opening_balance`, `current_balance`
- `is_active`, `allow_negative` (default false), `notes`

### `MoneyMovement` (`apps.payments.models`)
- `company`, `money_account`
- `movement_type`: `purchase_payment`, `sales_payment`, `supplier_payment`, `customer_collection`, `expense_payment`, `account_transfer`, `manual_adjustment`, `refund`, `opening_balance`
- `direction`: `in|out`
- `amount`, `reference_type`, `reference_id`, `description`, `reason`, `created_by`

## APIs

- `GET/POST /api/v1/tenant/money-accounts/`
- `GET/PATCH/DELETE /api/v1/tenant/money-accounts/{id}/`
- `GET /api/v1/tenant/money-accounts/{id}/movements/`
- `GET /api/v1/tenant/money-accounts/{id}/statement/` (`treasury.statement.view`)
- `POST /api/v1/tenant/money-accounts/{id}/adjustments/`
- `POST /api/v1/tenant/treasury/transfer/` (`treasury.transfer`)
- `GET /api/v1/tenant/treasury/summary/`

### List filters (added 2026-07-10)

- `GET /api/v1/tenant/money-accounts/?account_type=cashbox&is_active=true`
- `GET /api/v1/tenant/money-accounts/?account_type=bank&is_active=true`

Used by invoice screens to populate the separated cashbox / bank selectors.

## Cashbox / bank separation in invoices (2026-07-10)

The old single mixed dropdown (`الخزنة / الحساب البنكي`) was replaced:

- **Cash** payment → shows only active `account_type=cashbox` accounts, labeled `الخزنة` / `Cashbox`.
- **Bank** payment → shows only active `account_type=bank` accounts, labeled
  `الحساب البنكي` / `Bank Account`, with bank name / account number / balance in each option.
- **Credit** → account selector hidden, paid amount forced to 0, payable goes to supplier/customer.
- **Partial** → user first picks a source type (cashbox or bank), then the matching dropdown.
- Every option shows the account's `current_balance`; empty states show
  `لا توجد خزنة نشطة` / `لا توجد حسابات بنكية نشطة`.

Backend enforcement (`apps/purchases/services.py` approval):

- cash → account must be `cashbox`; bank → account must be `bank`; credit → account must be null.
  Mismatches are rejected with bilingual 400 errors.
- Insufficient balance errors are account-type specific:
  `code=insufficient_money_account_balance` with field error
  `الرصيد المتاح غير كافٍ لإتمام الدفعة.`

Tests: `tests/test_payments.py` (list filters), `tests/test_purchases.py`
(account-type mismatch rejections, insufficient cashbox balance, balance deduction).

## Rules

- Strict tenant isolation (`company_id` scope)
- Transactional balance updates via `post_money_movement()`
- Negative blocked by default (`allow_negative=false`)
- Opening balance creates an `opening_balance` movement
- Manual adjustments require non-empty reason
- Cancelling a payment movement reverses the original treasury movement by
  posting an opposite `MoneyMovement` with `reference_type=payment_movement_cancel`.
  The original selected cashbox/bank balance is restored in the same database
  transaction as ledger and invoice allocation reversal.

## Permissions

Added `treasury` permission group:
- `treasury.view`
- `treasury.create`
- `treasury.update`
- `treasury.delete`
- `treasury.adjust`
- `treasury.transfer`
- `treasury.movements.view`
- `treasury.statement.view`

Defaults:
- Owner/Admin: full
- Accountant: view, create, update, delete, adjust, transfer, movements, statement
- Cashier: `treasury.view` only

Tests: `tests/test_accounts.py` (15 integration scenarios), `tests/test_payments.py`, `tests/test_purchases.py`.
