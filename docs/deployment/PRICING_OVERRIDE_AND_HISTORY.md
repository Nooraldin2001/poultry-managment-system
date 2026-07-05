# Pricing Override and Historical Price Selection

- **Date (UTC):** 2026-07-05
- **Scope:** Tenant sales & purchase invoice line pricing

## Business rules

| Role | Sales override | Purchase override |
| --- | --- | --- |
| Owner / Admin | Yes (`sales.override_price` implicit) | Yes (`purchases.override_price` implicit) |
| Accountant | Yes if permission granted | Yes if permission granted |
| Cashier / Sales | Read-only unless permission granted | Read-only unless permission granted |

- Manual price is stored on the invoice line (`unit_price`, `price_source=manual_override`).
- Product default / supplier default prices are **not** changed when overriding on an invoice.
- Backend recalculates line totals, VAT, and document totals server-side.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/tenant/sales/price-history/?customer=&product=` | Last real prices for customer+product |
| GET | `/api/v1/tenant/purchases/price-history/?supplier=&product=` | Last real prices for supplier+product |
| PATCH | `/api/v1/tenant/sales/{id}/lines/{line_id}/` | Line update; override requires `sales.override_price` |
| PATCH | `/api/v1/tenant/purchases/{id}/lines/{line_id}/` | Line update; override requires `purchases.override_price` |

Payload fields for override:

```json
{
  "unit_price": "14.75",
  "price_type": "kg",
  "price_source": "manual_override",
  "override_reason": "Agreed old price"
}
```

## Frontend

- `LiveSalesInvoiceScreen` / `LivePurchaseInvoiceScreen`: editable unit price for authorized users.
- `PriceHistorySelect`: dropdown **اختيار سعر سابق** / **Use previous price**.
- `SalesLinePriceCell` / `PurchaseLinePriceCell`: fetch history after party + product selected.

## Tests

- `backend/tests/test_sales.py` — override permission, price history, tenant isolation
- `backend/tests/test_purchases.py` — same for purchases
- Frontend: `pnpm run typecheck`, `pnpm run build`

## Production smoke (First View admin)

1. Open sales invoice → select customer + product → change price → save draft → approve → print shows typed price.
2. Open previous prices dropdown → select old price → save → product default unchanged.
3. Repeat for purchase invoice with supplier.
