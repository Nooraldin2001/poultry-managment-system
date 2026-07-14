# Payments Module Audit

## Production Finding (2026-07-14)

First View Payments page loaded `GET /api/v1/tenant/payments/movements/?page=1&page_size=100`
successfully with HTTP 200. The frontend crashed while rendering the returned
rows:

```text
TypeError: undefined is not iterable (cannot read property Symbol(Symbol.iterator))
```

Root cause:

- Backend movement type: `customer_collection`
- UI badge key expected: `collection`
- Backend payment method: `bank_transfer`
- UI badge key expected: `bank`

The crash was a frontend enum mapping failure, not a failed payments API request.

## Fix Summary

- Normalize API enums before rendering payment movement rows.
- Add defensive badge fallbacks so unknown production enum values render as a
  generic muted badge instead of crashing.
- Preserve backend wire values for POST payloads: `bank_transfer` remains the
  canonical API value.
- Harden paginated `listAll()` parsing for malformed/missing `results`.

## Accounting/Treasury Fix

Payment cancellation now reverses the original `MoneyMovement` using
`reference_type=payment_movement_cancel`, restoring the selected cashbox/bank
balance in the same transaction as invoice allocations and party ledgers.

## Verification

- `python manage.py check` — pass
- `python -m pytest tests/test_payments.py` — pass
- `corepack pnpm run typecheck` — pass
- `corepack pnpm run build` — pass

Production deployment and AED 10 smoke tests remain pending until the fix is
deployed.
