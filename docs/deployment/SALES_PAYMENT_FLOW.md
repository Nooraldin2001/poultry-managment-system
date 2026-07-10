# Sales Payment Flow

## Approval behavior

Sales approval validates payment/treasury **before** stock deduction:

1. Validate `money_account` matches `payment_method` when `amount_paid > 0`
2. Deduct stock (FIFO)
3. Post `sales_payment` treasury **in** movement when paid
4. Post customer receivable for `total - amount_paid`

## Payment method rules

- `credit` — `amount_paid = 0`, no `money_account`, full amount to customer balance
- `cash` — requires active `cashbox`; increases balance by `amount_paid`
- `bank_transfer` — requires active `bank` account; increases balance by `amount_paid`

Frontend: `LiveSalesInvoiceScreen.tsx` + `salesService.ts` send `money_account` on draft PATCH.

Tests: `tests/test_accounts.py` (cash/bank sale), `tests/test_sales.py`.
