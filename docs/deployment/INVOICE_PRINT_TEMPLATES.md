# Invoice Print Templates — VAT Display Contract

**Last updated:** 2026-07-10

## Root cause (VAT duplication bug)

Print preview mapped `line_total` (subtotal **+** line VAT) into the table **Total / الإجمالي** column while the footer also showed **VAT** and **Subtotal**. Users saw VAT applied on every line and again at invoice level.

Example (750 g, 7.5 kg × 13.75):

| Field | Wrong (before) | Correct (after) |
|-------|----------------|-----------------|
| Line Total column | 108.28 (incl. VAT) | 103.12 (ex-VAT) |
| Footer Subtotal | 10,904.99 | Sum of ex-VAT lines |
| Footer VAT | 545.25 (duplicate) | 5.16 per line; summed once |
| Net / Grand | Inflated | subtotal + VAT − deductions |

## VAT-exclusive policy (default)

- `price_includes_vat` is **not** supported; entered unit price is always **before VAT**.
- `line_subtotal = quantity_basis × unit_price`
- `line_vat_amount = line_subtotal × vat_rate / 100`
- `line_total = line_subtotal + line_vat_amount` (stored; not shown in print table when footer has VAT)

## Print table columns

| Column | Source |
|--------|--------|
| Item / البند | `product_name` |
| Qty / الكمية | `cartons` or `quantity_cartons` |
| Unit / الوحدة | `kg` or `quantity_kg` |
| Price / السعر | `unit_price` (before VAT) |
| Total / الإجمالي | `display_total` or `line_subtotal` (**ex-VAT**) |

## Print footer

| Row | Purchase | Sales |
|-----|----------|-------|
| Subtotal before VAT | `totals.subtotal` | `totals.subtotal` |
| VAT | `totals.vat_amount` (once) | `totals.vat_amount` |
| Total incl. VAT | `totals.gross_total` | `totals.total_amount` |
| Deductions | slaughter / transport | — |
| Net payable | `totals.net_supplier_payable` | — |
| Paid / Balance | `amount_paid`, `balance_due` | same |

## Backend payload

`build_purchase_print_preview` / `build_print_preview` expose per line:

- `line_subtotal`, `line_vat_amount`, `line_total`, `display_total` (= `line_subtotal`)

Frontend `LivePrintPreviewScreen.mapPrintLines()` prefers `display_total` → `line_subtotal`.

## Tests

- `tests/test_invoice_line_pricing.py` — VAT-once cases for purchase/sales + print `display_total`
- `tests/test_purchases.py`, `tests/test_sales.py` — line subtotal by price_type

## Production smoke (First View)

1. Purchase invoice, VAT on, line 7.5 kg × 13.75 → print line total **103.12**, footer VAT **5.16**, net **108.28**
2. Sales invoice — same line → same ex-VAT line total; footer VAT once
3. VAT off → footer VAT hidden/zero; line total = subtotal
4. Tax report VAT matches approved invoice `vat_amount`
