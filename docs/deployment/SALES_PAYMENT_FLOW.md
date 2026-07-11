# Sales Payment Flow

## Draft vs approval

Draft sales invoices store `vat_rate`, `payment_method`, `money_account`, and `amount_paid` only. No treasury movement or customer ledger entries are created until approval.

## Approval behavior

Sales approval validates payment/treasury **before** stock deduction:

1. Recalculate invoice totals (backend source of truth)
2. Validate `money_account` matches `payment_method` when `amount_paid > 0`
3. Deduct stock (FIFO)
4. Post `sales_payment` treasury **in** movement when paid
5. Post customer receivable for `balance_due` only (`total_amount - amount_paid`)

## Payment method rules

| UI method | Stored `payment_method` | `amount_paid` | `money_account` | Customer balance |
|-----------|----------------------|---------------|-----------------|------------------|
| Cash | `cash` | full total | active cashbox | 0 when fully paid |
| Bank | `bank_transfer` | user amount (typically full) | active bank | unpaid remainder |
| Credit | `credit` | 0 | null | full total |
| Partial | `cash` or `bank_transfer` (from selected account) | partial amount | cashbox or bank | unpaid remainder |

Frontend partial selection resolves to `cash` or `bank_transfer` before PATCH, matching purchase invoices.

## VAT

- `vat_rate = 0` → VAT disabled, `vat_amount = 0`
- `vat_rate = 5` (tenant default) → VAT applied once on invoice subtotal
- Line print totals show ex-VAT subtotal; footer shows VAT once

## UI

`LiveSalesInvoiceScreen.tsx` — VAT toggle, paid/balance totals, cash/bank/credit/partial payment selectors with account balances.

## Tests

- `tests/test_sales.py` — VAT, credit, partial, validation, cancellation reversal, print totals
- `tests/test_accounts.py` — cash/bank sale treasury integration
- `tests/test_invoice_line_pricing.py` — VAT calculation once
