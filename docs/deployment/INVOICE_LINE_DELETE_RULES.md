# Invoice Line Delete Rules

## 2026-07-10 fix: `Method "DELETE" not allowed`

**Root cause:** `PurchaseInvoiceViewSet`, `SalesInvoiceViewSet`, and `QuotationViewSet` declared
`http_method_names` without `"delete"`, so DRF rejected every DELETE request with **405** before it
reached the `lines/{line_id}/` action — even though the action route itself supported DELETE.

**Fix:**

- Added `"delete"` to `http_method_names` in all three viewsets.
- Overrode `destroy()` to raise `MethodNotAllowed` so whole invoices/quotations still **cannot** be
  hard-deleted (cancel/void is the only path). Only the nested line/adjustment routes accept DELETE.
- Deleting a line from a non-draft invoice now returns **400** with a bilingual message:
  - AR: `لا يمكن حذف بند من فاتورة معتمدة`
  - EN: `Cannot delete a line from an approved invoice`
- `recalculate_*` services clear Django's prefetch cache before recomputing totals so a just-deleted
  line is never re-counted (the API loads invoices with `prefetch_related("lines", "adjustments")`).
- Frontend (`LivePurchaseInvoiceScreen`, `LiveSalesInvoiceScreen`) refetches full invoice detail
  after every successful line delete, so totals always come from the backend.

Regression tests: `backend/tests/test_invoice_line_delete.py` (draft delete + recalculation,
approved blocked 400, invoice hard delete blocked 405, cashier 403, cross-tenant 404).

## Backend routes (draft-only)

- `DELETE /api/v1/tenant/purchases/{invoice_id}/lines/{line_id}/`
- `DELETE /api/v1/tenant/sales/{invoice_id}/lines/{line_id}/`
- `DELETE /api/v1/tenant/quotations/{quotation_id}/lines/{line_id}/`

## Business rules

- Draft documents: line delete allowed
- Approved/cancelled documents: delete blocked (`_require_draft`)
- After delete: server recalculates totals

## Frontend behavior

Implemented in:
- `LivePurchaseInvoiceScreen`
- `LiveSalesInvoiceScreen`
- `LiveQuotationScreen`

Rules:
- Unsaved local line: remove locally
- Saved line: call DELETE API
- Clear permission error message on denied delete:
  - AR: `?? ???? ?????? ??? ??? ?????`
  - EN: `You do not have permission to delete this line`
- Delete button hidden without permission

Permission checks accept either explicit future line-delete permissions or existing edit permissions:
- `sales.lines.delete` OR `sales.edit`
- `purchases.lines.delete` OR `purchases.edit`
- `quotations.lines.delete` OR `quotations.edit`

