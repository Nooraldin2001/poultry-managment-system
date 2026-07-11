# Purchase Service Costs (Slaughterhouse & Transport)

## Overview

Purchase invoices can link **slaughterhouse** and **transport** service suppliers with independent modes:

| Mode | Poultry supplier payable | Final invoice cost | Service supplier payable |
|------|--------------------------|--------------------|--------------------------|
| `deduct` | Reduced by service amount | Unchanged (reallocation) | Service amount |
| `add` | Unchanged (full gross) | Increased by service amount | Service amount |

## API fields

```json
{
  "slaughterhouse_supplier": 12,
  "slaughterhouse_amount": "60.00",
  "slaughterhouse_mode": "deduct",
  "transport_supplier": 18,
  "transport_amount": "40.00",
  "transport_mode": "add",
  "service_notes": "..."
}
```

Legacy names (`slaughterhouse_deduction_amount`, `deduction_notes`) remain accepted for backward compatibility.

## Calculations (backend source of truth)

```text
gross_poultry_total = subtotal + payable_adjustments + VAT
final_invoice_total = gross_poultry_total + service_additions
poultry_supplier_net_payable = gross_poultry_total - service_deductions
```

Validation: `service_deductions <= gross_poultry_total`.

## Inventory costing

- **Add mode:** service amounts are included in `inventory_cost_total` and allocated across stock lines by subtotal proportion.
- **Deduct mode:** inventory cost remains the gross poultry cost (no double reduction).

## Supplier categories

Service dropdowns filter by stable category codes:

- `GET /api/v1/tenant/suppliers/?category_code=slaughterhouse&is_active=true`
- `GET /api/v1/tenant/suppliers/?category_code=transport&is_active=true`

Ensure categories exist per tenant:

```bash
python manage.py ensure_service_supplier_categories --company-subdomain firstview
```

When creating suppliers, persist the **category ID** from `/tenant/supplier-categories/`.

## Deployment

```bash
python manage.py migrate
python manage.py seed_permissions
python manage.py ensure_service_supplier_categories --company-subdomain firstview
bash scripts/deploy_vps.sh
```
