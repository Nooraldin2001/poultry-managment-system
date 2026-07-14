# Supplier Payment Flow

## Canonical Endpoint

`POST /api/v1/tenant/payments/supplier-payments/`

```json
{
  "supplier": 8,
  "amount": "1000.00",
  "payment_method": "bank_transfer",
  "money_account": 4,
  "movement_date": "2026-07-14",
  "reference_number": "TRX-123",
  "notes": "",
  "allocations": [
    { "purchase_invoice": 17, "allocated_amount": "1000.00" }
  ]
}
```

## Rules

- `payment_method`: `cash|bank_transfer|cheque|other`
- `cash` requires a `cashbox` money account.
- `bank_transfer` and `cheque` require a `bank` money account.
- Selected account must have enough available balance unless `allow_negative=true`.
- Allocations cannot exceed payment amount or purchase invoice outstanding balance.
- Empty `allocations` records an on-account supplier payment.

## Atomic Effects

- Creates `PaymentMovement(supplier_payment)`.
- Creates `PaymentAllocation` rows for allocated purchases.
- Debits the supplier ledger and reduces `supplier.current_balance`.
- Increases `PurchaseInvoice.amount_paid`, reduces `balance_due`, and updates status.
- Posts `MoneyMovement(supplier_payment, out)` and decreases selected account balance.
- Cancellation reverses ledger, invoice allocation, and treasury in one transaction.

## Error Contract

Insufficient selected account balance returns:

```json
{
  "detail": "Insufficient balance in the selected account.",
  "code": "insufficient_money_account_balance",
  "fields": {
    "money_account": ["الرصيد المتاح غير كافٍ لإتمام الدفعة."]
  }
}
```
