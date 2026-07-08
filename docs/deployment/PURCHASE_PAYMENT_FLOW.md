# Purchase Payment Flow

## Approval behavior

Purchase approval now posts side effects in this order:

1. Recalculate and validate lines
2. Apply inventory stock side effects (FIFO)
3. Apply paid part to selected money account (cash/bank) as treasury `out` movement
4. Post supplier payable ledger for outstanding part only

## Payment method rules

- `credit`
  - `amount_paid` must be `0`
  - no treasury deduction
  - supplier payable = invoice total

- `cash`
  - requires `money_account` of type `cashbox`
  - deducts `amount_paid` from that account
  - supplier payable = `total - amount_paid`

- `bank_transfer` / `cheque`
  - requires `money_account` of type `bank`
  - deducts `amount_paid` from that account
  - supplier payable = `total - amount_paid`

- partial payment
  - represented by non-credit payment method + `amount_paid < total`
  - deduct paid part from account; outstanding part posted to supplier

## Safety constraints

- Draft purchase: no treasury/supplier side effects
- Approve only from draft: no double deduction
- `amount_paid > total` rejected
- Missing account for paid cash/bank purchases rejected

## Cancellation

For approved/paid/partially-paid purchase cancel:
- reverse inventory layers (if not consumed)
- reverse supplier payable by `supplier_payable_posted`
- reverse treasury outflow by posting `refund` movement (`direction=in`) for prior purchase payment amount

