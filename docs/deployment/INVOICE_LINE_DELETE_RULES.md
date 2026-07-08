# Invoice Line Delete Rules

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

