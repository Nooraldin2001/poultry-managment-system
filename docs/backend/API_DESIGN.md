# Poultry Hero — REST API Design

> **Design only.** DRF resource surface for the future backend. Aligned with the
> frontend service names in `Poultry managment system/src/services/index.ts` and the
> proposals in `API_BOUNDARY_PLAN.md`.

---

## 1. Base URL strategy

- All endpoints under versioned base: **`/api/v1/`**.
- Two scopes:
  - **Super Admin** (cross-tenant): `/api/v1/admin/...`
  - **Tenant** (current company, implicit): `/api/v1/...`
- JSON only. Dates ISO-8601. Money as decimal strings (e.g. `"1234.50"`); quantities:
  `cartons`/`pieces` integers, `kg` decimal string. (Final money wire format — see
  OPEN_QUESTIONS.)

## 2. Tenant / subdomain strategy

- Tenant is resolved from **(a)** the authenticated user's `company` and **(b)** the
  request `Host` subdomain; mismatch → `403`.
  - `admin.poultryhero.solutions` → Super Admin scope.
  - `<sub>.poultryhero.solutions` → tenant whose `Company.subdomain == <sub>`.
- Clients **never** send `company_id`; the server derives and stamps it.
- Local dev: `<sub>.localhost:8000` or `/etc/hosts` aliases.

## 3. Conventions

- **Auth:** `Authorization: Bearer <access>` (JWT). Matches `client.ts` seam.
- **Pagination/filtering** (mirrors `ListParams`): `?search=&page=&page_size=` plus
  resource-specific filters (e.g. `?status=`, `?date_from=&date_to=`).
- **List response:** `{count, next, previous, results: [...]}` (maps to `ListResponse<T>`).
- **Detail response:** the object (maps to `ItemResponse<T>`).
- **Errors:** `{detail, code, fields?}`; `400` validation, `401` auth, `403` permission /
  tenant / module-disabled, `404`, `409` conflict (e.g. insufficient stock).
- **Side-effect actions** are `POST .../{id}/<action>/`.
- **Sensitive actions** require body `{ "reason": "<text>" }`; missing/empty → `400`.

### Permission codes referenced below
`<module>.view`, `<module>.add`, `<module>.change`, `sales.approve`, `sales.cancel`,
`sales.edit_price`, `purchase.approve`, `purchase.cancel`, `inventory.adjust`,
`payment.cancel`, `customer.increase_credit_limit`, `tax.change_rate`, etc.
(full catalog in BUSINESS_RULES / DATABASE_SCHEMA `PermissionCatalog`).

---

## 4. Authentication endpoints  (`/api/v1/auth/`)

| Path | Method | Purpose | Request | Response | Perms | Side effects |
| --- | --- | --- | --- | --- | --- | --- |
| `/auth/login/` | POST | Email/password login | `{email, password}` | `{access, refresh, user}` | public | issues JWT; rate-limited |
| `/auth/refresh/` | POST | Refresh access token | `{refresh}` | `{access}` | public | |
| `/auth/logout/` | POST | Invalidate refresh | `{refresh}` | `204` | auth | blacklist token |
| `/auth/me/` | GET | Current user + company + effective permissions | — | `{user, company, permissions[]}` | auth | |
| `/auth/password/change/` | POST | Change own password | `{old, new}` | `204` | auth | |

`user` payload: `{id, email, full_name, role, company_id, is_superuser}`.

---

## 5. Super Admin endpoints  (`/api/v1/admin/`, super-admin only, global scope)

| Path | Method | Purpose | Request (summary) | Response | Perms | Side effects |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin/companies/` | GET | List tenants (→ `listCompanies`) | filters: `status`, `search` | `ListResponse<Company>` | super admin | |
| `/admin/companies/` | POST | Create tenant + subscription | `{name_ar,name_en,subdomain,plan,emirate,...}` | `Company` | super admin | creates Company + CompanySubscription + module gating |
| `/admin/companies/{id}/` | GET | Tenant detail (→ `getCompanyById`) | — | `Company` | super admin | |
| `/admin/companies/{id}/` | PATCH | Update tenant/plan/status/limits | partial | `Company` | super admin | audited (status/plan/limit changes) |
| `/admin/companies/{id}/admin-user/` | POST | Create first tenant admin user | `{email,full_name,password}` | `User` | super admin | creates Owner/Admin in company |
| `/admin/companies/{id}/suspend/` | POST | Suspend tenant | `{reason}` | `Company` | super admin | sets status=suspended (audit) |
| `/admin/companies/{id}/activate/` | POST | Reactivate tenant | — | `Company` | super admin | audit |
| `/admin/plans/` | GET/POST | Plan catalog | | `Plan[]` / `Plan` | super admin | |
| `/admin/subscriptions/{company_id}/payments/` | GET/POST | Manual SaaS payments | `{amount,method,paid_on,period_label}` | payment list/item | super admin | updates total_paid / outstanding_amount |
| `/admin/dashboard/summary/` | GET | SaaS KPIs (revenue, active tenants, audit feed) | | KPI bundle | super admin | |
| `/admin/audit/` | GET | Global super-admin audit feed | filters | `ListResponse<AuditLog>` | super admin | |

---

## 6. Tenant dashboard endpoints  (`/api/v1/`)

| Path | Method | Purpose | Response | Perms |
| --- | --- | --- | --- | --- |
| `/dashboard/summary/` | GET | KPI bundle (→ `getDashboardSummary`) | `{kpis, recentActivity, alerts}` | `dashboard.view` |
| `/tenant/reports/dashboard/` | GET | Phase 10 KPI + trend bundle | KPI cards + `sales_trend[]` | `reports.view_dashboard` |

---

> **Phase 2 implementation note (sections 7–9).** Master-data endpoints ship
> under the tenant prefix **`/api/v1/tenant/`** (e.g. `/api/v1/tenant/products/`,
> `/api/v1/tenant/customers/`, `/api/v1/tenant/suppliers/`) and permission codes
> use the `group.action` form (`products.view`, `customers.set_credit_limit`,
> `suppliers.special_prices.manage`, …). Compared to the original design:
> categories are first-class (`product-categories/`, `customer-categories/`,
> `supplier-categories/`); opening-balance edits use dedicated
> `…/{id}/opening-balance/` actions (reason required) instead of PATCH; hard
> DELETE is replaced by `…/{id}/disable/` + `…/{id}/reactivate/`; ledger +
> statement read endpoints exist. See `PHASE_2_IMPLEMENTATION_NOTES.md` for the
> authoritative list.

## 7. Product endpoints  (`/api/v1/products/`)

| Path | Method | Purpose | Request | Response | Perms | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/products/` | GET | List (→ `listProducts`) | `search,product_type,is_active` | `ListResponse<Product>` | `product.view` | tenant-scoped |
| `/products/` | POST | Create | product fields | `Product` | `product.add` | validates weight by type |
| `/products/{id}/` | GET | Detail (→ `getProductById`) | — | `Product` | `product.view` | |
| `/products/{id}/` | PATCH | Update | partial | `Product` | `product.change` | price changes may be sensitive |
| `/products/{id}/` | DELETE | Disable (no hard delete) | — | `204`→sets `is_active=false` | `product.change` | blocked hard-delete if referenced |
| `/categories/` | GET/POST | Categories | | | `product.view`/`add` | |

---

## 8. Customer endpoints  (`/api/v1/customers/`)

| Path | Method | Purpose | Request | Response | Perms | Side effects |
| --- | --- | --- | --- | --- | --- | --- |
| `/customers/` | GET | List (→ `listCustomers`) | `search,customer_type,overdue` | `ListResponse<Customer>` | `customer.view` | |
| `/customers/` | POST | Create | customer fields | `Customer` | `customer.add` | opening balance sets initial balance |
| `/customers/{id}/` | GET | Detail (→ `getCustomerById`) | — | `Customer` | `customer.view` | |
| `/customers/{id}/` | PATCH | Update | partial | `Customer` | `customer.change` | opening-balance edit is **sensitive** (reason) |
| `/customers/{id}/credit-limit/` | POST | Increase credit limit | `{new_limit, scope: permanent|one_invoice, reason}` | `Customer` | `customer.increase_credit_limit` | **sensitive**; audit |
| `/customers/{id}/statement/` | GET | Statement (opening, sales, collections, discounts, placeholders) | `date_from,date_to` | statement bundle | `customer.view` | |
| `/customers/{id}/special-prices/` | GET/POST/PATCH | Special prices | | list/item | `customer.change` | active until changed |
| `/customers/{id}/free-products/` | GET/POST | Free-product agreements | | | `customer.change` | |

---

## 9. Supplier endpoints  (`/api/v1/suppliers/`)

| Path | Method | Purpose | Request | Response | Perms | Side effects |
| --- | --- | --- | --- | --- | --- | --- |
| `/suppliers/` | GET | List (→ `listSuppliers`) | `search,supplier_type` | `ListResponse<Supplier>` | `supplier.view` | |
| `/suppliers/` | POST | Create | fields | `Supplier` | `supplier.add` | opening balance |
| `/suppliers/{id}/` | GET | Detail (→ `getSupplierById`) | — | `Supplier` | `supplier.view` | |
| `/suppliers/{id}/` | PATCH | Update | partial | `Supplier` | `supplier.change` | opening-balance edit **sensitive** |
| `/suppliers/{id}/statement/` | GET | Statement (opening, purchases, payments, deductions, cancellations, placeholders) | `date_from,date_to` | bundle | `supplier.view` | |
| `/suppliers/{id}/agreement/` | GET/PUT | Agreement defaults | | agreement | `supplier.change` | |
| `/suppliers/{id}/special-prices/` | GET/POST/PATCH | Special purchase prices | | | `supplier.change` | active until changed |

---

## 10. Sales endpoints  (`/api/v1/tenant/sales/`)  — ✅ IMPLEMENTED (Phase 5)

Base path is `/api/v1/tenant/sales/`. Permission codes use `sales.*` namespace.

| Path | Method | Purpose | Request | Perms | Side effects |
| --- | --- | --- | --- | --- | --- |
| `/sales/` | GET | List | filters: `customer,status,payment_status,date_from,date_to,invoice_number,search,has_balance,vat_enabled` | `sales.view` | |
| `/sales/` | POST | Create **draft** (with `lines[]`, `adjustments[]`) | `{customer, invoice_date, lines[], adjustments[]?, payment_method?, vat_rate?, amount_paid?, due_date?, notes?}` | `sales.create` | **no** stock/ledger change |
| `/sales/{id}/` | GET | Detail (lines + adjustments) | — | `sales.view` | cost/profit fields gated |
| `/sales/{id}/` | PATCH | Edit **draft only** | partial | `sales.edit` | recompute totals |
| `/sales/{id}/approve/` | POST | **Approve** | `{reason, credit_override?}` | `sales.approve` | FIFO deduct + customer receivable (`balance_due`); audit; reason required |
| `/sales/{id}/cancel/` | POST | **Cancel** | `{reason}` | `sales.cancel` | return stock + reverse receivable; audit; reason required |
| `/sales/{id}/collection-adjustment/` | POST | Post-approval balance reduction | `{amount, reason}` | `sales.collection_adjustment` | customer credit only; no line edits |
| `/sales/summary/` | GET | KPIs | — | `sales.view` | |
| `/sales/{id}/print-preview/` | GET | Print JSON template | — | `sales.print` | no PDF yet |
| `/sales/price-preview/` | GET | Resolved price for customer/product | `customer,product,price_type` | `sales.view` | |
| `/sales/stock-check/` | GET | Availability check | `product,cartons?,pieces?,kg?` | `sales.view` | |
| `/sales/{id}/lines/` | GET/POST | List / add line (POST draft-only) | line payload | view / `sales.edit` | special/free pricing rules |
| `/sales/{id}/lines/{line_id}/` | PATCH/DELETE | Edit / remove line (draft-only) | partial | `sales.edit` | |
| `/sales/{id}/adjustments/` | GET/POST | Draft invoice discounts | adjustment payload | view / `sales.apply_discount` | |
| `/customers/{id}/sales/` | GET | Customer sales history | — | `sales.view` | |

> Manual price override requires `sales.override_price` + audit. Free products require
> active agreement or `sales.sensitive`. Credit-limit override requires
> `sales.credit_override` + reason on approve.

---

## 11. Quotation endpoints  (`/api/v1/tenant/quotations/`)  — ✅ IMPLEMENTED (Phase 7)

| Path | Method | Purpose | Perms | Side effects |
| --- | --- | --- | --- | --- |
| `/quotations/` | GET, POST | List / create draft | `quotations.view`, `quotations.create` | **none** |
| `/quotations/summary/` | GET | KPIs | `quotations.view` | |
| `/quotations/{id}/` | GET, PATCH | Detail / edit draft | view / `quotations.edit` | |
| `/quotations/{id}/send/` | POST | Draft → sent | `quotations.send` | |
| `/quotations/{id}/accept/` | POST | Sent → accepted | `quotations.accept` | |
| `/quotations/{id}/reject/` | POST | Reject | `quotations.reject` | reason required |
| `/quotations/{id}/cancel/` | POST | Cancel | `quotations.cancel` | reason required |
| `/quotations/{id}/convert-to-sales/` | POST | → sales draft | `quotations.convert_to_sales` | creates draft only |
| `/quotations/{id}/print-preview/` | GET | JSON preview | `quotations.print` | not tax invoice |
| `/quotations/{id}/stock-warning/` | GET | Availability info | `quotations.view` | no stock movement |
| `/quotations/price-preview/` | GET | Price resolution | `quotations.view` | |
| `/quotations/expire-overdue/` | POST | Mark expired | `quotations.send` | draft/sent only |
| `/quotations/{id}/lines/` | GET, POST | Lines | view / edit | draft only |
| `/customers/{id}/quotations/` | GET | Customer history | `quotations.view` | |

---

## 12. Purchase endpoints  (`/api/v1/tenant/purchases/`)  — ✅ IMPLEMENTED (Phase 4)

Base path is `/api/v1/tenant/purchases/`. Permission codes use the `purchases.*`
namespace. Draft has no side effects; approval adds stock + posts supplier payable;
cancellation reverses both (or is blocked if stock was consumed).

| Path | Method | Purpose | Request | Perms | Side effects |
| --- | --- | --- | --- | --- | --- |
| `/purchases/` | GET | List | filters: `supplier,status,payment_status,date_from,date_to,supplier_invoice_number,search,has_balance,vat_enabled` | `purchases.view` | |
| `/purchases/` | POST | Create **draft** (with `lines[]`, `adjustments[]`) | `{supplier, invoice_date, lines[], adjustments[]?, payment_method?, vat_rate?, amount_paid?, supplier_invoice_number?, due_date?, notes?}` | `purchases.create` | **no** stock/ledger change |
| `/purchases/{id}/` | GET | Detail (lines + adjustments + attachments) | — | `purchases.view` | |
| `/purchases/{id}/` | PATCH | Edit **draft only** (replaces lines/adjustments if sent) | partial | `purchases.edit` | recompute totals |
| `/purchases/{id}/approve/` | POST | **Approve** | `{reason}` | `purchases.approve` | add stock + FIFO layers + supplier payable; audit; reason required |
| `/purchases/{id}/cancel/` | POST | **Cancel** | `{reason}` | `purchases.cancel` | reverse stock if layers unconsumed (else 400), reverse supplier payable; audit; reason required |
| `/purchases/summary/` | GET | KPIs (month total, counts, unpaid balance, supplier payable, VAT) | — | `purchases.view` | |
| `/purchases/{id}/lines/` | GET/POST | List / add line (POST draft-only) | line payload | view / `purchases.edit` | recompute |
| `/purchases/{id}/lines/{line_id}/` | PATCH/DELETE | Edit / remove line (draft-only) | partial | `purchases.edit` | recompute |
| `/purchases/{id}/adjustments/` | GET/POST | List / add adjustment (POST draft-only) | `{adjustment_type, effect, title, amount, vat_rate?}` | view / `purchases.manage_adjustments` | effect drives payable vs inventory cost vs expense |
| `/purchases/{id}/adjustments/{id}/` | PATCH/DELETE | Edit / remove adjustment (draft-only) | partial | `purchases.manage_adjustments` | recompute |
| `/purchases/{id}/attachments/` | GET/POST | List / upload supplier invoice (multipart) | `file, file_type?, notes?` | view / `purchases.upload_attachment` | audit `supplier_invoice_upload` |
| `/suppliers/{id}/purchases/` | GET | Supplier purchase history | — | `purchases.view` | |

---

## 13. Inventory endpoints  (`/api/v1/tenant/inventory/`)  ✅ IMPLEMENTED (Phase 3)

> Implemented under `/api/v1/tenant/inventory/` (tenant-scoped). The UI shows
> total stock per product (`InventoryBalance`); FIFO layers stay hidden and
> power valuation. See `PHASE_3_INVENTORY_IMPLEMENTATION_NOTES.md`.

| Path | Method | Purpose | Request | Response | Perms | Side effects |
| --- | --- | --- | --- | --- | --- | --- |
| `inventory/` | GET | On-hand per product | `product,category,status,low_stock,out_of_stock,search` | balance list | `inventory.view` | reads `InventoryBalance`; `estimated_fifo_value` only if `inventory.view_valuation` |
| `inventory/summary/` | GET | Totals + low/out counts + FIFO value | — | summary | `inventory.view` | |
| `inventory/low-stock/` | GET | Low / out-of-stock products | — | balance list | `inventory.view` | |
| `inventory/products/{id}/` | GET | Single product balance + recent movements | — | detail | `inventory.view` | |
| `inventory/products/{id}/movements/` | GET | Per-product movement ledger | — | movement list | `inventory.view_movements` | |
| `inventory/movements/` | GET | Global movement ledger | `product,movement_type,date_from,date_to,reference_type,user` | movement list | `inventory.view_movements` | |
| `inventory/valuation/` | GET | FIFO valuation per product + total | — | valuation | `inventory.view_valuation` | Owner/Admin + Accountant by default; Cashier denied |
| `inventory/opening-stock/` | POST | Initialize opening stock | `{product, cartons, pieces, kg, unit_cost_per_kg, reference_number?, reason, notes?}` | movement | `inventory.adjust` | `add_stock(opening_inventory)` → FIFO layer + movement; **reason required** |
| `inventory/adjustments/` | GET/POST | **Manual stock adjustment** | `{product, adjustment_type, cartons/pieces/kg or new_*, unit_cost_per_kg?, reason}` | adjustment | view / `inventory.adjust` | **updates balance + StockMovement (+FIFO)**; no negative stock; **sensitive (reason)** |
| `inventory/adjustments/{id}/` | GET | Adjustment detail | — | adjustment | `inventory.view` | |
| `inventory/stocktaking/` | GET/POST | List / open count session | `{count_date?, generate_lines?, reason?, notes?}` | session | view / `inventory.stocktaking.create` | snapshots system qty |
| `inventory/stocktaking/{id}/` | GET | Session detail + lines | — | session | `inventory.view` | |
| `inventory/stocktaking/{id}/lines/` | GET/POST | List / enter counts | `{product, actual_*}` | line | `inventory.stocktaking.create` | computes diff |
| `inventory/stocktaking/{id}/lines/{line_id}/` | PATCH | Update a count line | `{actual_*, reason?}` | line | `inventory.stocktaking.create` | recomputes diff (draft only) |
| `inventory/stocktaking/{id}/apply/` | POST | **Apply differences** | `{reason}` | session | `inventory.stocktaking.apply` | creates movements per diff; cannot apply twice; **sensitive** |

---

## 14. Payment / receipt endpoints  (`/api/v1/tenant/payments/`)  — ✅ IMPLEMENTED (Phase 6)

Base path `/api/v1/tenant/payments/` and `/api/v1/tenant/receipts/`. Permission codes use `payments.*` and `receipts.*`.

| Path | Method | Purpose | Perms | Side effects |
| --- | --- | --- | --- | --- |
| `/payments/summary/` | GET | Payment KPIs | `payments.view` | |
| `/payments/movements/` | GET | List movements | `payments.view` | filters: movement_type, party_type, customer, supplier, status, dates, amounts |
| `/payments/movements/{id}/` | GET | Detail + allocations | `payments.view` | |
| `/payments/movements/{id}/cancel/` | POST | Cancel movement | `payments.cancel` | reverses ledger + invoice allocations; reason required |
| `/payments/movements/{id}/print-preview/` | GET | Receipt JSON | `payments.print` | |
| `/payments/customer-collections/` | POST | Customer collection | `payments.create_customer_collection` | credit customer ledger; optional sales allocations |
| `/payments/supplier-payments/` | POST | Supplier payment | `payments.create_supplier_payment` | debit supplier ledger; optional purchase allocations |
| `/payments/customer-refunds/` | POST | Customer refund | `payments.create_customer_refund` | reason required |
| `/payments/supplier-refunds/` | POST | Supplier refund | `payments.create_supplier_refund` | reason required |
| `/customers/{id}/collections/` | GET | Customer collection history | `payments.view` | |
| `/suppliers/{id}/payments/` | GET | Supplier payment history | `payments.view` | |
| `/payments/reconciliation/customers/{id}/` | GET | Balance reconciliation | `payments.reconcile` | |
| `/payments/reconciliation/suppliers/{id}/` | GET | Balance reconciliation | `payments.reconcile` | |
| `/receipts/` | GET | Receipt list | `receipts.view` | |
| `/receipts/{id}/` | GET | Receipt detail | `receipts.view` | |
| `/receipts/{id}/print-preview/` | GET | Receipt JSON | `receipts.print` | |

---

## 15. Expense endpoints  (`/api/v1/tenant/`)

| Path | Method | Purpose | Perms | Notes |
| --- | --- | --- | --- | --- |
| `/expense-categories/` | GET/POST | List/create categories | `expenses.view` / `manage_categories` | |
| `/expense-categories/{id}/` | GET/PATCH | Detail/update | `expenses.view` / `manage_categories` | |
| `/expenses/` | GET/POST | List/create expenses | `expenses.view` / `create` | purchase-linked on draft purchase only |
| `/expenses/{id}/` | GET/PATCH | Detail / notes-only edit | `expenses.view` / `edit` | posted: notes fields only |
| `/expenses/{id}/cancel/` | POST | Cancel (reason required) | `expenses.cancel` | sensitive |
| `/expenses/{id}/voucher-preview/` | GET | Voucher JSON | `expenses.print` | bilingual, no PDF |
| `/expenses/{id}/attachments/` | GET/POST | Receipt uploads | `view` / `upload_attachment` | |
| `/expenses/summary/` | GET | Dashboard summary | `expenses.view` | |
| `/expenses/profit-impact/` | GET | Profit foundation | `expenses.view_profit_impact` | `date_from`, `date_to` required |
| `/recurring-expenses/` | GET/POST | Recurring templates | `view` / `manage_recurring` | |
| `/recurring-expenses/{id}/generate/` | POST | Manual generate | `manage_recurring` | advances next_due_date |

---

## 16. Tax / VAT endpoints  (`/api/v1/tenant/tax/`)

| Path | Method | Purpose | Perms | Notes |
| --- | --- | --- | --- | --- |
| `/tax/summary/` | GET | Overview (sales/purchase/expense/net VAT) | `tax.view` | `date_from`, `date_to` |
| `/tax/sales-vat/` | GET | Sales VAT report | `tax.view_sales_vat` | approved/paid only |
| `/tax/purchase-vat/` | GET | Purchase VAT report | `tax.view_purchase_vat` | approved/paid only |
| `/tax/expense-vat/` | GET | Expense VAT report | `tax.view_expense_vat` | posted only |
| `/tax/net-vat/` | GET | Net VAT estimate | `tax.view_net_vat` | internal estimate |
| `/tax/export-payload/` | GET | Export-ready JSON | `tax.export` | audited |
| `/tax/warnings/` | GET | List warnings | `tax.view` | |
| `/tax/warnings/generate/` | POST | Generate warnings | `tax.generate_warnings` | idempotent |
| `/tax/warnings/{id}/dismiss/` | POST | Dismiss (reason) | `tax.dismiss_warnings` | sensitive |
| `/tax/warnings/{id}/resolve/` | POST | Resolve | `tax.dismiss_warnings` | |
| `/tax/adjustments/` | GET/POST | Manual VAT adjustments | `view` / `tax.adjust` | |
| `/tax/adjustments/{id}/cancel/` | POST | Cancel adjustment | `tax.cancel_adjustment` | sensitive |
| `/tax/periods/` | GET/POST | Tax periods | `tax.view` | |
| `/tax/periods/{id}/review/` | POST | Mark reviewed | `tax.view` | |
| `/tax/periods/{id}/close/` | POST | Close period | `tax.view` | blocks adjustments |
| `/tax/disabled-vat-documents/` | GET | VAT-disabled docs review | `tax.view` | |
| `/tax/audit/` | GET | Tax audit log entries | `tax.view_audit` | |

VAT settings remain at `/api/v1/tenant/settings/vat/` (Phase 0–1).

---

## 17. Report endpoints  (`/api/v1/tenant/reports/`)

| Path | Method | Purpose | Response | Perms |
| --- | --- | --- | --- | --- |
| `/reports/dashboard/` | GET | KPI cards + sales trend | totals + `sales_trend[]` | `reports.view_dashboard` |
| `/reports/sales/` | GET | Sales report (filters) | rows + totals + breakdowns | `reports.view_sales` |
| `/reports/purchases/` | GET | Purchase report | rows + totals + breakdowns | `reports.view_purchases` |
| `/reports/inventory/` | GET | Stock balances + FIFO value | balances + chart status | `reports.view_inventory` |
| `/reports/inventory-valuation/` | GET | Same as inventory (audited) | balances + FIFO totals | `reports.view_inventory_valuation` |
| `/reports/inventory-movements/` | GET | Movement history report | rows + inbound/outbound totals | `reports.view_inventory` |
| `/reports/customers/{id}/statement/` | GET | Customer statement | ledger + aging | `reports.view_customer_statement` |
| `/reports/customers/aging/` | GET | All-customer aging | rows | `reports.view_customer_statement` |
| `/reports/suppliers/{id}/statement/` | GET | Supplier statement | ledger + aging | `reports.view_supplier_statement` |
| `/reports/suppliers/aging/` | GET | All-supplier aging | rows | `reports.view_supplier_statement` |
| `/reports/payments/` | GET | Payment movements report | rows + totals | `reports.view_payments` |
| `/reports/expenses/` | GET | Expense report | rows + category chart | `reports.view_expenses` |
| `/reports/profit/` | GET | Gross/net profit foundation | margins + by-day/product | `reports.view_profit` (**audited**) |
| `/reports/tax-summary/` | GET | Bridge to Phase 9 net VAT | net VAT estimate | `reports.view_tax_summary` |
| `/reports/export-payload/` | GET | Export-ready JSON (no file) | metadata + report | `reports.export` (**audited**) |

Query: `date_from`, `date_to`, `customer`, `supplier`, `product`, `category`, `payment_status`,
`include_cancelled`, `include_drafts`, `group_by`, etc.

Legacy `reports.view` / `reports.export` codes remain; granular `reports.view_*` codes are preferred.

---

## 18. Settings endpoints  (`/api/v1/settings/`)

| Path | Method | Purpose | Request | Response | Perms | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/settings/company/` | GET/PUT | Company settings (TRN, logo, defaults) | fields | `CompanySettings` | `settings.view`/`change` | |
| `/settings/numbering/` | GET/PUT | Numbering sequences | per doc_type | list | `settings.change` | **editing numbering sensitive** |
| `/settings/print-templates/` | GET/POST/PUT | Print templates | template | list/item | `settings.change` | **editing template sensitive** |
| `/settings/users/` | GET/POST | Tenant users (→ future users service) | `{email,full_name,role,password}` | `User` | `user.manage` | create blocked if active users ≥ plan user_limit |
| `/settings/users/{id}/` | PATCH | Update user / suspend | partial / `{is_active,reason}` | `User` | `user.manage` | **suspend/reactivate sensitive** |
| `/settings/users/{id}/permissions/` | GET/PUT | Per-user permission overrides | `{overrides[]}` | permissions | `user.manage` | **change permissions sensitive** |

---

## 19. Audit endpoints  (`/api/v1/audit/`)

| Path | Method | Purpose | Request | Response | Perms |
| --- | --- | --- | --- | --- | --- |
| `/audit/` | GET | Tenant audit log (read-only) | `entity_type,action,date_*,actor` | `ListResponse<AuditLog>` | `audit.view` |
| `/audit/{id}/` | GET | Single entry | — | `AuditLog` | `audit.view` |

> Audit entries are created by services, never via API write. No update/delete endpoints.

---

## 20. File upload endpoints  (`/api/v1/files/`)

| Path | Method | Purpose | Request | Response | Perms | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/files/` | POST | Upload attachment | multipart `{file, entity_type, entity_id, kind}` | `FileAttachment` | module-specific add | size/type validated; stored under `company_id/` |
| `/files/{id}/` | GET | Download (signed) | — | file / redirect | view perm for owning entity | tenant-scoped |
| `/files/{id}/` | DELETE | Remove attachment | — | `204` | change perm | soft handling for referenced docs |

---

## 21. Side-effect summary (must be enforced server-side, atomically)

| Action | Inventory | Balances | Audit |
| --- | --- | --- | --- |
| Approve sales invoice | deduct via FIFO, set COGS | customer balance += remaining | yes |
| Cancel sales invoice | restore consumed layers | customer balance −= remaining | yes + reason |
| Approve purchase invoice | add stock + create FIFO layers | supplier balance += remaining | yes |
| Cancel purchase invoice | reverse layers (else `409`) | supplier balance −= remaining | yes + reason |
| Customer collection | — | invoice paid/remaining + customer balance | yes |
| Supplier payment | — | purchase paid/remaining + supplier balance | yes |
| Cancel payment/receipt | — | reverse balance + allocations | yes + reason |
| Stock adjustment | update balance + movement | — | yes + reason |
| Apply stocktaking | movements per diff | — | yes + reason |
| Change/disable VAT | — | — | yes + reason |
| Increase credit limit | — | customer credit_limit | yes + reason |
| Any sensitive action | per action | per action | **reason required** |
