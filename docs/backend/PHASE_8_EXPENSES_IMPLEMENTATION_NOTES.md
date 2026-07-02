# Phase 8 — Expenses (implementation notes)

Status: ✅ DONE. 288 tests passing (246 prior + 42 new). No production demo seed.

## App created

`apps.expenses` at `/api/v1/tenant/expenses/`, `/expense-categories/`, `/recurring-expenses/`.

## Models

- **ExpenseCategory** — tenant categories (daily/monthly/recurring/purchase_linked/general).
- **Expense** — posted expense voucher with VAT, payment method, optional purchase link.
- **RecurringExpense** — template for manual generation (no background job yet).
- **ExpenseAttachment** — receipt/invoice proof uploads.
- **ExpenseStatusHistory** — posted → cancelled trail.

## Services

`create_expense`, `cancel_expense`, `create_recurring_expense`, `generate_expense_from_recurring`,
`get_expense_summary`, `get_profit_impact_foundation`, `build_expense_voucher_preview`,
`daily_expenses_total`, `monthly_expenses_total`.

## Daily / monthly behavior

- `expense_scope=daily` or `general` counts in daily operational totals.
- `expense_scope=monthly` or `recurring_generated` counts in monthly totals.
- Cancelled expenses excluded from all summaries and profit impact.

## Recurring behavior

Templates store amount/VAT/recurrence. `POST .../recurring-expenses/{id}/generate/` creates
one posted expense with `expense_scope=recurring_generated`, advances `next_due_date`.
Duplicate generation for same template+date blocked via `reference_number`.
`auto_generate=false` by default — no deployment/migration auto-run.

## Purchase-linked behavior

| Behavior | Effect | Counts in expense totals? |
| --- | --- | --- |
| `expense_only` | Expense only | Yes |
| `reduce_supplier_payable` | Draft `PurchaseAdjustment` (reduce payable) | No |
| `increase_inventory_cost` | Draft `PurchaseAdjustment` (landed cost) | No |
| `none` | No purchase effect | Yes (if posted) |

Approved purchases are **blocked** for payable/cost adjustments from expenses module.
Cancellation removes linked draft adjustment when safe.

## Cancellation / reversal

Requires reason (`expense_cancel` sensitive action). Marks `status=cancelled`, writes
status history + audit. Does not delete expense row.

## Voucher print-preview

`GET .../voucher-preview/` returns bilingual EXPENSE VOUCHER / سند مصروف JSON (no PDF).

## Profit impact foundation

`GET .../profit-impact/?date_from=&date_to=` returns approved sales/purchases totals,
operational expenses total, gross profit sum (if available), net/fifo foundations, and
disclaimer notes. Not a final accounting report.

## Numbering

`DocumentType.EXPENSE_VOUCHER` → `EXP-YYYY-NNNNN` via `generate_document_number`.

## Permissions

`expenses.view`, `.create`, `.edit`, `.cancel`, `.print`, `.export`, `.manage_categories`,
`.manage_recurring`, `.purchase_link`, `.view_profit_impact`, `.upload_attachment`.

Accountant: all except cancel. Cashier: none by default.

## Production data hygiene

No demo seed command added. Deploy scripts unchanged (migrate only, no business seeds).
`purge_demo_data` deletes expense models before quotations.

## Tests

42 tests in `tests/test_expenses.py` — categories, creation, VAT, purchase-link,
cancellation, recurring, voucher preview, summary/profit impact, permissions, tenant isolation.

## Limitations

- No double-entry accounting or payment ledger posting from expenses.
- No PDF rendering.
- No background recurring job (manual generate endpoint only).
- Post-approval purchase payable/cost adjustment from expenses blocked.
- Full reports module deferred to Phase 10.

## Next recommended phase

Phase 9 — Tax/VAT Management (sales/purchase/expense VAT, net estimate, TRN warnings).
