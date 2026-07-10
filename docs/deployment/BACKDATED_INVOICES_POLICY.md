# Backdated Invoices Policy

## Overview

Tenants may create **sales** and **purchase** invoices with a business `invoice_date` before today when authorized. The system keeps `created_at` / `updated_at` as real system timestamps.

## Two date concepts

| Field | Meaning |
|-------|---------|
| `invoice_date` | Business date chosen by the user (may be in the past) |
| `created_at` | Actual system creation timestamp (never overwritten) |

## Permissions

| Permission | Module |
|------------|--------|
| `sales.backdate` | Sales invoices |
| `purchases.backdate` | Purchase invoices |
| `expenses.backdate` | Expenses (when expense forms use business dates) |
| `payments.backdate` | Payments/receipts (when applicable) |

**Default role policy**

- **Owner / Admin:** allowed (all permissions)
- **Accountant:** allowed (`sales.backdate`, `purchases.backdate` in role defaults)
- **Cashier / Sales:** not allowed by default

Unauthorized backdate attempts return **403** with:

- EN: `You do not have permission to create a backdated invoice`
- AR: `لا تملك صلاحية إنشاء فاتورة بتاريخ سابق`

## Reason requirement

When `invoice_date < today`:

- `backdate_reason` is **required** on create/update (draft only)
- An audit log entry is written (`backdate_sales_invoice` / `backdate_purchase_invoice`) with actor, document id, `invoice_date`, `created_at`, and reason

### 2026-07-10 fix: approval of backdated drafts

**Root cause:** partial updates (PATCH) on an already-backdated draft failed validation when the
payload did not repeat `backdate_reason`, and the approve flow could not supply a reason at all —
so backdated drafts were stuck (`مش بيعتمد فواتير قديمه خالص`).

**Fix:**

- `InvoiceDateValidationMixin` now falls back to the reason **already stored on the instance**
  during partial updates; resaving/approving a backdated draft no longer demands a duplicate reason.
- Approve serializers (`PurchaseApproveSerializer`, `SalesApproveSerializer`) accept an optional
  `backdate_reason`, and `ensure_backdate_reason_for_approval()` (in `apps/core/document_dates.py`)
  validates it at approval time: if the invoice is backdated and has no stored reason, a reason
  must accompany the approve call, otherwise approval proceeds with the stored reason.
- Frontend approve calls pass `backdate_reason` when the invoice is backdated, and `todayIso()` in
  `BackdateInvoiceFields.tsx` now uses the **local** date (previously UTC, which mis-flagged
  invoices as backdated between 00:00–04:00 UAE time).

Regression tests: `backend/tests/test_backdated_invoices.py` (PATCH without duplicate reason,
approve via API for sales + purchases, approve without stored reason requires a reason).

## Validation rules

1. `invoice_date` is required
2. Past dates allowed with permission + reason
3. **Future dates blocked** — `Invoice date cannot be in the future`
4. **Approved invoices:** `invoice_date` is read-only (cannot change after approval)
5. **Closed tax periods:** blocked unless user has `tax.sensitive` (via `validate_document_date_is_open`)

## Side effects on approval

### Sales

- Customer ledger `entry_date` = `invoice_date`
- Stock movement `movement_date` = `invoice_date`
- Stock validated against **current** available stock (no historical reconstruction)
- Reports/tax/profit filter by `invoice_date`

### Purchases

- Supplier ledger `entry_date` = `invoice_date`
- Stock movement `movement_date` = `invoice_date`
- FIFO layer `received_at` derived from `invoice_date`
- Purchase payment at approval uses `movement_date` = `invoice_date`
- Separate payment records continue to use their own `payment_date` / `movement_date`

## Invoice numbering

Numbers remain **sequential by creation order**, not by `invoice_date`.

Example: `INV-00030` created today with `invoice_date = 2026-07-05` is valid.

## Reports

Business reports use business dates:

- Sales / purchase / tax / profit → `invoice_date`
- Customer/supplier statements → ledger `entry_date`
- Inventory movement report → `StockMovement.movement_date`
- Dashboard today/month → `invoice_date` (not `created_at`)

## Locked periods

`TaxPeriod` closed ranges are enforced. No `AccountingPeriod` / `VATPeriod` models exist yet; helper `validate_document_date_is_open()` is ready for extension.

## Frontend

- Date picker: past allowed (with permission), future blocked (`max=today`)
- Warning + required reason textarea when date &lt; today
- Approved invoice date is read-only

## Deployment

```bash
cd backend
python manage.py migrate
python manage.py check
python -m pytest tests/test_backdated_invoices.py tests/test_sales.py tests/test_purchases.py tests/test_reports.py tests/test_tax.py tests/test_inventory.py

cd ../frontend
corepack pnpm run typecheck
corepack pnpm run build
```

## Limitations

- Stock checks on backdated sales use **current** stock, not point-in-time stock
- Approved invoice date changes are not supported (would require ledger/tax recalculation)
- Expenses/payments backdating follows existing date fields only; not expanded in this release unless those modules already expose business dates
