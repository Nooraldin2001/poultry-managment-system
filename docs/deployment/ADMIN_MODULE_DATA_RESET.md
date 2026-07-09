# Super Admin Module Data Reset

Controlled, per-module tenant data wipe for **Super Admin only**. One module per operation; company record, users, subscription, settings, and branding assets are **never** deleted.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/admin/companies/{id}/module-reset/catalog/` | Module list + backup warnings |
| POST | `/api/v1/admin/companies/{id}/module-reset/dry-run/` | Preview counts and blockers |
| POST | `/api/v1/admin/companies/{id}/module-reset/confirm/` | Execute reset (transactional) |
| GET | `/api/v1/admin/companies/{id}/module-reset/history/` | Audit-backed history |

**Permission:** `IsSuperAdmin` (`user.is_superuser`). Tenant users must not access these routes.

## Supported modules

| Key | Deletes | Preserves |
|-----|---------|-----------|
| `sales` | Sales invoices, lines, adjustments, allocations, status history, sales ledger entries, sales stock movements | Purchases, customers, products, company |
| `purchases` | Purchase invoices, lines, adjustments, attachments, status history, supplier ledger (purchase), FIFO layers from purchases, purchase stock movements | Sales (blocks reset if posted sales exist) |
| `payments` | Payment movements, allocations, status history | Invoices remain; balances recalculated |
| `expenses` | Expenses, attachments, recurring expenses, status history | Treasury money accounts (movements from expenses removed with expense reset) |
| `quotations` | Quotations and lines | Sales, customers |
| `inventory` | Balances, FIFO layers, movements, adjustments, stocktaking, valuation snapshots | **Blocked** if posted sales/purchases exist |
| `customers` | Customers, categories, special prices, free-product agreements, ledger, credit-limit history | **Blocked** if sales/payments/ledger exist |
| `suppliers` | Suppliers, categories, agreements, special prices, supplier ledger | **Blocked** if purchases/payments exist |
| `products` | Products and categories | **Blocked** if referenced by documents |
| `tax` | Open tax periods, warnings, adjustments | Closed tax periods; transactions |
| `reports` | `InventoryValuationSnapshot` only | All transactional data |
| `treasury` | Money accounts and movements | **Blocked** if payments, expenses, or paid purchases exist |

## Dependency rules (no force reset)

**Force reset is not supported.** Any request with `force`, `force_reset`, `force_rebuild`, `delete_anyway`, `ignore_dependencies`, or `override_dependencies` is rejected with HTTP 400.

When dependencies exist, dry-run returns:

- `can_reset: false`
- `blocking_dependencies` (English)
- `blocking_dependencies_ar` (Arabic)
- `required_reset_order` — modules to reset first, one at a time

| Module | Blocked when | Required order (when blocked) |
|--------|--------------|-------------------------------|
| **Sales** | Payment allocations on sales exist | `payments` → `sales` |
| **Purchases** | Posted sales, sales allocations, sales stock movements, or sales payment links | `payments` → `sales` → `inventory` → `purchases` |
| **Inventory** | Posted sales or purchases | `payments` → `sales` → `purchases` → `inventory` |
| **Customers** | Sales, payments, quotations, or ledger entries | `payments` → `sales` → `quotations` → `customers` |
| **Suppliers** | Purchases, payments, or supplier ledger | `payments` → `purchases` → `suppliers` |
| **Products** | Referenced by sales/purchases/quotations/inventory/movements/FIFO | `payments` → `sales` → `purchases` → `quotations` → `inventory` → `products` |
| **Treasury** | Payments, expenses, or paid purchases | `payments` → `expenses` → `purchases` → `treasury` |
| **Payments** | Always allowed (dependent records) | — |
| **Reports** | Never blocks transactions; snapshots only | — |

Confirm **re-runs** dependency checks. If state changed since dry-run, confirm is blocked and nothing is deleted.

## Confirmation flow

1. Super Admin selects **one** module.
2. **Dry-run** returns `affected_counts`, `side_effects`, `blocking_dependencies`, `required_reset_order`, and `required_confirmation_text`.
3. Format: `RESET {MODULE} FOR {subdomain}` (example: `RESET SALES FOR firstview`).
4. Confirm requires: `reason`, exact `confirmation_text`, signed `dry_run_token` (default required).
5. Optional setting `REQUIRE_BACKUP_BEFORE_MODULE_RESET=True` enforces `backup_confirmed: true`.
6. All deletes run inside `transaction.atomic()` per handler.

## Recalculation after reset

| Module | Recalculation |
|--------|----------------|
| Sales | `rebuild_customer_balances`, `rebuild_inventory_balances_from_layers` |
| Purchases | `rebuild_supplier_balances`, `rebuild_inventory_balances_from_layers` |
| Payments | Customer/supplier balances; invoice payment states |
| Expenses | Treasury balances (if money movements deleted) |
| Others | Module-specific; see `apps/tenants/module_reset/recalc.py` |

## Audit log

Actions: `module_reset_dry_run`, `module_reset_confirm`, `module_reset_blocked`. Blocked attempts (dry-run and confirm) are logged with dependencies and required order.

## Known limitations

- **Sales reset** does not restore FIFO stock consumed by deleted sales; inventory is rebuilt from **remaining** FIFO layers only.
- **Payments reset** removes payment records; invoices may show unpaid again; does not delete unrelated `MoneyMovement` rows unless part of payment/expense flows.
- **Reports** are mostly live-calculated; reset only removes stored valuation snapshots.
- No automatic full-database backup; UI shows backup warning and optional checkbox.
- **No force reset** — dependencies must be cleared one module at a time in the order shown.

## Frontend

Super Admin → Company detail → **Danger Zone** tab (`AdminModuleResetPanel`). Red styling, dry-run required, typed confirmation, reason required, backup checkbox.

## Deployment

1. Deploy backend + frontend bundle.
2. Verify Super Admin can open catalog on a test company.
3. Dry-run sales on a sandbox tenant; confirm counts match expectations.
4. Do **not** run confirm on production without a verified DB backup.
5. Run smoke: `pytest tests/test_admin_module_reset.py`

## Settings

```python
REQUIRE_DRY_RUN_TOKEN_MODULE_RESET = True  # default
REQUIRE_BACKUP_BEFORE_MODULE_RESET = False  # set True to enforce backup_confirmed
```
