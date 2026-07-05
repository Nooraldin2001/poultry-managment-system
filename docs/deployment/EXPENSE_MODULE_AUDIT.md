# Expense Module Audit — First View Production Fix

**Date:** 2026-07-05  
**Tenant:** `firstview` (`https://firstview.poultryhero.solutions`)

## Demo data source

**Primary source: frontend hardcoded constants in `ExpensesModule.tsx`**, not mock API mode:

| Constant | Demo content shown in live mode |
|---|---|
| `MOCK_EXPENSES` | إيجار السكن, إيجار السيارات, رواتب, … |
| `RECURRING` | Same names + amounts 4500, 2300, 18000, 650, 350 |
| `EXPENSE_TREND` | Fake 7-day chart |
| `CAT_DIST` | Fake category pie (الرواتب AED 18,000, etc.) |

`useExpenses` correctly avoided mock list when `VITE_USE_MOCK_DATA=false`, but **overview charts, recurring panel, and report screen ignored live mode** and always rendered constants.

Secondary: DB may also contain seeded demo expenses — use scoped purge command (see below).

## Fix (frontend)

- Overview: KPIs/charts/recurring from `getExpensesSummary()` + `listRecurringExpenses()` + computed live expense rows.
- `RecurringExpensesScreen`: loads live API; empty state when none.
- `ExpensesReportScreen`: loads filtered live expenses; no `MOCK_EXPENSES` table in live mode.
- `enrichExpense()`: merges mock metadata only when `IS_MOCK_MODE`.
- `expenseService.listRecurringExpenses()`: maps `title`, `next_due_date`, `recurrence`.

## Fix (expense creation — Phase 2)

**Root cause:** `AddExpenseModal` submit handlers only called `toast.success()` — no `POST /api/v1/tenant/expenses/`, no list refetch, no persistence after refresh.

**Fix:**
- Load categories from `GET /api/v1/tenant/expense-categories/` (numeric category PK).
- Submit via `createExpense()` with `title`, `expense_date`, `amount`, `expense_scope`, `payment_method`.
- Inline category creation when none exist (`POST /api/v1/tenant/expense-categories/`).
- Loading state on save; DRF field errors via `FormErrors`; refetch list on success.

## Demo purge command

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --module expenses --dry-run
python manage.py purge_tenant_demo_data --company-subdomain firstview --module expenses --confirm-delete-demo-data
```

Demo matchers: known Arabic titles (إيجار السكن, …), Demo/Sample/Test patterns, known amounts **with** matching demo titles.

**Does not** delete expenses solely because category name matches demo.

## Tests added

- `test_purge_tenant_demo_expenses_dry_run`
- `test_purge_tenant_demo_expenses_confirm_deletes_only_demo`

## Production verification (pending deploy + optional DB purge)

1. **المصروفات** — no demo rows/charts after deploy.
2. Empty state when no real expenses.
3. Add expense → POST → refresh → persists.
4. Run dry-run purge on VPS; confirm only demo titles before `--confirm-delete-demo-data`.

## Remaining blockers

- Deploy required before client sees UI fix.
- VPS dry-run/confirm not executed in this session (SSH/deploy pending user approval).
- Add-expense modal still toast-only (pre-existing); live create flow may need separate wiring if not already routed through `createExpense`.
