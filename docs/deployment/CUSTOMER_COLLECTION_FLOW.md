# Customer Collection Flow

## Canonical Endpoint

`POST /api/v1/tenant/payments/customer-collections/`

```json
{
  "customer": 12,
  "amount": "500.00",
  "payment_method": "cash",
  "money_account": 3,
  "movement_date": "2026-07-14",
  "reference_number": "",
  "notes": "",
  "allocations": [
    { "sales_invoice": 29, "allocated_amount": "500.00" }
  ]
}
```

## Rules

- `payment_method`: `cash|bank_transfer|cheque|other`
- `cash` requires a `cashbox` money account.
- `bank_transfer` and `cheque` require a `bank` money account.
- Allocations cannot exceed payment amount or invoice outstanding balance.
- Empty `allocations` records an on-account collection against customer balance.

## Atomic Effects

- Creates `PaymentMovement(customer_collection)`.
- Creates `PaymentAllocation` rows for allocated invoices.
- Credits the customer ledger and reduces `customer.current_balance`.
- Increases `SalesInvoice.amount_paid`, reduces `balance_due`, and updates status.
- Posts `MoneyMovement(customer_collection, in)` and increases selected account balance.
- Cancellation reverses ledger, invoice allocation, and treasury in one transaction.

## Production Note

The Payments screen production crash on 2026-07-14 was not an API failure. The
movements GET returned 200, but the frontend displayed raw API enum
`customer_collection` in a badge that only knew `collection`.
