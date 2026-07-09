# Supplier Service Accounts (Slaughterhouse & Transport)

Service vendors (slaughterhouses, transport drivers) are modeled as **Supplier** records with a **SupplierCategory** code — not a separate account table.

## Category codes

| Code | Arabic | Use |
|------|--------|-----|
| `slaughterhouse` | مسلخ | Slaughterhouse deductions on purchase invoices |
| `transport` | نقل / سائق | Transport deductions on purchase invoices |
| `poultry` | دواجن | Poultry farm suppliers (optional) |
| `food_company` | شركة أغذية | General food suppliers |

## Creating service accounts

1. Go to **Suppliers → Categories** (or create category via API)
2. Add category with code `slaughterhouse` or `transport`
3. Create supplier linked to that category
4. Supplier appears in purchase invoice deduction dropdowns (filtered by category)

## Balance & statements

- Slaughterhouse/transport balances increase when purchase invoices with deductions are **approved**
- Ledger entry type: `purchase_deduction`
- Use existing **Supplier statement** and **Supplier ledger** screens
- Pay slaughterhouse/transport via normal **Supplier payments** module

## API filter

```http
GET /api/v1/tenant/suppliers/?category_code=slaughterhouse&is_active=true
GET /api/v1/tenant/suppliers/?category_code=transport&is_active=true
```

See [PURCHASE_DEDUCTIONS_SLAUGHTER_TRANSPORT.md](./PURCHASE_DEDUCTIONS_SLAUGHTER_TRANSPORT.md) for accounting rules.
