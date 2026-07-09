# Purchase Slaughterhouse & Transport Deductions

## Business rule

When approving a purchase invoice from a poultry supplier:

```text
Gross total (subtotal + VAT + payable adjustments)
- Slaughterhouse deduction
- Transport deduction
= Net poultry supplier payable
```

Example:

| Item | Amount |
|------|--------|
| Gross purchase | AED 10,000 |
| Slaughterhouse deduction | AED 600 |
| Transport deduction | AED 400 |
| **Poultry supplier payable** | **AED 9,000** |
| **Slaughterhouse payable** | **AED 600** |
| **Transport payable** | **AED 400** |
| **Total business cost** | **AED 10,000** |

Deductions reduce what is owed to the poultry supplier. They are **not lost** — they create separate payables to slaughterhouse and transport service accounts.

## Architecture

Uses existing **Supplier** records classified by **SupplierCategory.code**:

| Code | Purpose |
|------|---------|
| `slaughterhouse` | Slaughterhouse / مسلخ |
| `transport` | Transport / driver / نقل |
| `poultry` | Poultry farm suppliers (optional) |

No separate `ServiceAccount` model — service vendors are suppliers with category codes and full ledger/statement support.

## Purchase invoice fields

| Field | Description |
|-------|-------------|
| `gross_total` | Subtotal + VAT + payable adjustments (before service deductions) |
| `slaughterhouse_supplier` | FK to slaughterhouse supplier |
| `slaughterhouse_deduction_amount` | Amount withheld for slaughterhouse |
| `transport_supplier` | FK to transport supplier |
| `transport_deduction_amount` | Amount withheld for transport |
| `deduction_notes` | Optional notes |
| `total_amount` | Net poultry supplier payable |
| `slaughterhouse_deduction_posted` / `transport_deduction_posted` | Posted amounts (for cancellation reversal) |

Draft invoices store deductions but **do not** affect balances until approval.

## Accounting on approval

1. **Poultry supplier ledger** — credit = `net_supplier_payable - amount_paid` (entry type `purchase_invoice`)
2. **Slaughterhouse supplier ledger** — credit = slaughterhouse deduction (entry type `purchase_deduction`)
3. **Transport supplier ledger** — credit = transport deduction (entry type `purchase_deduction`)
4. **Cash/bank** — money movement for `amount_paid` against net payable (unchanged pattern)
5. **Inventory** — FIFO cost from `inventory_cost_total` = gross poultry line subtotal (+ inventory-cost adjustments only)

## Inventory cost rule (default)

```text
Inventory cost = gross poultry cost (NOT reduced by slaughter/transport deductions)
Supplier payable = gross - deductions
Service payables = deductions
Total cost across all parties = gross poultry cost
```

This prevents artificially inflating profit by lowering inventory cost when deductions are really payables to other parties.

## Validation

- Deduction amounts ≥ 0
- Total deductions ≤ gross total
- Deduction > 0 requires matching supplier account
- All accounts must belong to the same tenant company
- Deductions applied only on approval

## Cancellation

Reverses poultry supplier payable and both service deduction ledger entries (append-only debit entries).

## Frontend

- **Purchase invoice** → section **Invoice Deductions / خصومات مرتبطة بالفاتورة**
- Dropdowns filter suppliers by `category_code=slaughterhouse` or `transport`
- Live totals show gross, deductions, net supplier payable
- Print preview shows deduction rows when amounts > 0

## Supplier management

Create suppliers under **Suppliers** with categories:

- Category code `slaughterhouse` for slaughterhouses
- Category code `transport` for drivers/transport companies

Use existing supplier statement/ledger screens for slaughterhouse and transport balances.

## Tests

```bash
cd backend
python manage.py check
python -m pytest tests/test_purchases.py -k "deduction or slaughter or transport" -v
```

## Production verification

1. Create slaughterhouse supplier (category `slaughterhouse`)
2. Create transport supplier (category `transport`)
3. Create purchase from poultry supplier with lines
4. Add slaughter + transport deductions on draft
5. Approve with reason
6. Verify poultry supplier balance = net payable
7. Verify slaughterhouse/transport balances increased
8. Verify inventory stock-in at gross unit cost
9. Print preview shows deductions
