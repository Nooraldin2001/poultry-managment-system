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
- `movement_type`: `purchase_payment`, `supplier_payment`, `customer_collection`, `expense_payment`, `manual_adjustment`, `refund`, `opening_balance`
- `direction`: `in|out`
- `amount`, `reference_type`, `reference_id`, `description`, `reason`, `created_by`

## APIs

- `GET/POST /api/v1/tenant/money-accounts/`
- `GET/PATCH /api/v1/tenant/money-accounts/{id}/`
- `GET /api/v1/tenant/money-accounts/{id}/movements/`
- `POST /api/v1/tenant/money-accounts/{id}/adjustments/`
- `GET /api/v1/tenant/treasury/summary/`

## Rules

- Strict tenant isolation (`company_id` scope)
- Transactional balance updates via `post_money_movement()`
- Negative blocked by default (`allow_negative=false`)
- Opening balance creates an `opening_balance` movement
- Manual adjustments require non-empty reason

## Permissions

Added `treasury` permission group:
- `treasury.view`
- `treasury.create`
- `treasury.update`
- `treasury.adjust`
- `treasury.movements.view`

Defaults:
- Owner/Admin: full
- Accountant: full treasury ops
- Cashier: `treasury.view` only
