# Poultry Hero — Database Schema (PostgreSQL)

> **Design only.** Normalized schema for the shared-DB multi-tenant backend.
> Conventions below apply to every table unless stated otherwise.

## Conventions

- **PK:** `id` — `BigAutoField` (or UUID where noted for externally exposed IDs).
- **Timestamps:** every table has `created_at`, `updated_at` (from `TimeStampedModel`).
- **Tenant isolation:** tenant-owned tables have `company_id FK → tenants.company`
  (`on_delete=PROTECT`, indexed). Listed explicitly as **Tenant: yes (company_id)**.
  Global/super-admin tables say **Tenant: no (global)**.
- **Soft delete / active:** master data uses an `is_active` boolean (disable, never
  delete) because they are referenced by transactions. Transactional documents use a
  `status` lifecycle (incl. `cancelled`) instead of deletion. Stated per table.
- **Money:** `DecimalField(max_digits=14, decimal_places=2)` (AED). **Quantities:**
  `cartons`/`pieces` = `IntegerField`; `kg` = `DecimalField(max_digits=12, decimal_places=3)`.
- **Audit:** state-changing rows are recorded in `audit.AuditLog`; sensitive changes
  carry a `reason`.
- **Tenant-scoped uniqueness:** unique constraints are `(company_id, <field>)`.

---

# App: tenants (global / super-admin owned)

## Company  *(the tenant)*
- **Purpose:** a poultry distribution company tenant managed by Super Admin.
- **Tenant:** no (global). This row *defines* a tenant.
- **Soft delete:** `is_active` + `status`; never hard-deleted.
- **Fields:**
  | field | type | req | notes |
  | --- | --- | --- | --- |
  | id | BigAuto/UUID | yes | exposed as tenant id |
  | name_ar | char(255) | yes | Arabic legal/display name |
  | name_en | char(255) | yes | English name |
  | subdomain | slug(63) | yes | **unique**; e.g. `primefresh` |
  | emirate | char(64) | no | UAE emirate |
  | trade_license | char(64) | no | |
  | admin_name | char(255) | no | seeded contact (first admin) |
  | admin_phone | char(32) | no | |
  | admin_email | email | no | |
  | enabled_modules | JSON (list[str]) | yes | module gating (driven by plan) |
  | status | char enum: `trial|active|suspended` | yes | default `trial` |
  | is_active | bool | yes | default true |
  | created_at/updated_at | datetime | yes | |
- **Unique:** `subdomain` (global unique).
- **Indexes:** `subdomain`, `status`.
- **Relationships:** 1—1 `CompanySubscription`; 1—1 `CompanySettings`/`VatSettings`;
  1—N `User`, and every tenant-owned table.

---

# App: subscriptions (global, about a company)

## Plan
- **Purpose:** SaaS plan catalog (Basic / Pro / Enterprise).
- **Tenant:** no (global).
- **Fields:** id; `code` (`basic|pro|enterprise`, **unique**); `name_ar`; `name_en`;
  `monthly_price` money; `yearly_price` money; `user_limit` int (default 3 for base);
  `modules` JSON(list[str]) (default enabled modules); `is_active` bool.
- **Unique:** `code`.

## CompanySubscription
- **Purpose:** current subscription state for a company (manual billing).
- **Tenant:** no (global; FK to one company).
- **Fields:** id; `company_id` FK→Company (**unique**, 1—1); `plan_id` FK→Plan;
  `status` enum `trial|active|suspended`; `monthly_price` money (override of plan);
  `yearly_price` money; `billing_cycle` enum `monthly|yearly`; `renewal_date` date;
  `user_limit` int (effective, defaults from plan); `outstanding_amount` money (default 0);
  `total_paid` money (default 0); `last_payment_date` date null; `started_at` date.
- **Unique:** `company_id`.
- **Indexes:** `status`, `renewal_date`.
- **Audit:** plan/status/limit changes logged (super-admin actions).

## SubscriptionPayment  *(manual SaaS payment)*
- **Purpose:** record a manual SaaS payment from a company to the operator.
- **Tenant:** no (global).
- **Fields:** id; `company_id` FK→Company; `amount` money; `method` enum
  `cash|transfer|cheque|other`; `paid_on` date; `period_label` char (e.g. "يناير 2025");
  `reference` char null; `notes` text null; `recorded_by_id` FK→User (super admin).
- **Indexes:** `company_id`, `paid_on`.
- **Side effects:** increments `CompanySubscription.total_paid`, reduces
  `outstanding_amount`, may set `last_payment_date`.

---

# App: users + permissions

## User  *(custom auth user)*
- **Purpose:** authentication identity. Super Admin (company null) or tenant user.
- **Tenant:** mixed — tenant users carry `company_id`; super admins have `company=NULL`.
- **Soft delete:** `is_active` (suspend/reactivate; sensitive action).
- **Fields:** id; `email` (login, **unique global**); `password` (hashed);
  `full_name` char; `phone` char null; `company_id` FK→Company null (null = super admin);
  `role` enum `owner|accountant|cashier` null (null for super admin);
  `is_staff` bool; `is_superuser` bool; `is_active` bool; `last_login` datetime null.
- **Unique:** `email` (global). Consider also `(company_id, email)` not needed since global.
- **Indexes:** `email`, `company_id`, `role`.
- **Business:** active-user count per company ≤ `CompanySubscription.user_limit`.

## PermissionCatalog
- **Purpose:** canonical list of app permission codes (incl. sensitive ones).
- **Tenant:** no (global reference data).
- **Fields:** id; `code` (**unique**, e.g. `sales.edit_price`, `sales.approve`,
  `customer.increase_credit_limit`); `label_ar`; `label_en`; `module` char;
  `is_sensitive` bool (requires reason+audit).
- **Unique:** `code`.

## RolePermissionDefault
- **Purpose:** default allow/deny per role per permission.
- **Tenant:** no (global defaults) — optionally per-company override table later.
- **Fields:** id; `role` enum; `permission_id` FK→PermissionCatalog; `allowed` bool.
- **Unique:** `(role, permission)`.

## UserPermissionOverride
- **Purpose:** per-user grant/revoke vs role default (Admin customization).
- **Tenant:** yes (company_id) — user belongs to a company.
- **Fields:** id; `company_id`; `user_id` FK→User; `permission_id` FK→PermissionCatalog;
  `allowed` bool; `set_by_id` FK→User.
- **Unique:** `(user, permission)`.
- **Audit:** changes are a sensitive action (`change user permissions`).

## ModuleAccess *(optional explicit gating; else derive from Company.enabled_modules)*
- **Purpose:** which modules a company can use (driven by plan).
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `module` char; `enabled` bool.
- **Unique:** `(company, module)`.

---

# App: settings

## CompanySettings
- **Purpose:** per-company configuration (1—1 with Company).
- **Tenant:** yes (company_id, **unique**).
- **Fields:** id; `company_id` (1—1); `legal_name_ar`; `legal_name_en`; `trn` char null
  (company VAT TRN); `address` text null; `phone`; `email`; `currency` default `AED`;
  `logo_id` FK→FileAttachment null; `default_pieces_per_carton` int null;
  `premium_whatsapp_enabled` bool default false (feature lock).
- **Unique:** `company_id`.

## NumberingSequence
- **Purpose:** document numbering config + counter per document type.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `doc_type` enum `sales|purchase|quotation|receipt|expense`;
  `prefix` char; `next_number` int; `padding` int; `reset_policy` enum `never|yearly`;
  `year` int null.
- **Unique:** `(company, doc_type)`.
- **Audit:** editing numbering is a sensitive action.
- **Concurrency:** number assignment uses `select_for_update()`.

## PrintTemplate
- **Purpose:** print/PDF template config per document type.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `doc_type` enum; `name`; `config` JSON (layout, fields,
  footer, logo flag); `is_default` bool; `is_active` bool.
- **Unique:** `(company, doc_type, name)`.
- **Audit:** editing template is a sensitive action.

---

# App: products

## Category
- **Tenant:** yes (company_id). **Soft delete:** `is_active`.
- **Fields:** id; `company_id`; `name_ar`; `name_en`; `is_active`.
- **Unique:** `(company, name_en)`.

## Product
- **Purpose:** sellable item: fixed weight bird, moving/custom weight, by-product, or part.
- **Tenant:** yes (company_id). **Soft delete:** `is_active` (disable, never delete if used).
- **Fields:**
  | field | type | req | notes |
  | --- | --- | --- | --- |
  | id | BigAuto | yes | |
  | company_id | FK | yes | |
  | code | char(64) | yes | SKU; **unique per company** |
  | name_ar | char(255) | yes | |
  | name_en | char(255) | yes | |
  | category_id | FK→Category | no | |
  | product_type | enum `fixed_weight|moving_weight|byproduct|part` | yes | |
  | weight_grams | int | no | required for fixed/moving weight (e.g. 400–1500 fixed; 1550+ moving) |
  | is_variable_weight | bool | yes | true for moving/custom |
  | default_pieces_per_carton | int | no | for carton↔piece conversion |
  | sales_price | money | yes | |
  | sales_price_type | enum `kg|piece|carton|tray` | yes | |
  | purchase_price | money | no | |
  | purchase_price_type | enum `kg|piece|carton|tray` | no | |
  | min_stock_cartons | int | no | low-stock alert |
  | min_stock_kg | decimal | no | |
  | is_vat_taxable | bool | yes | default true |
  | is_active | bool | yes | default true |
- **Unique:** `(company, code)`.
- **Indexes:** `(company, is_active)`, `(company, product_type)`.
- **Relationships:** referenced by sales/purchase/quotation lines, inventory, special prices.
- **Rule:** cannot be deleted when referenced; only `is_active=false`.

---

# App: customers

## Customer
- **Purpose:** customer account with balance + credit.
- **Tenant:** yes (company_id). **Soft delete:** `is_active`.
- **Fields:** id; `company_id`; `name_ar`; `name_en` null; `phone` null; `trn` char null;
  `customer_type` enum `cash|credit`; `opening_balance` money default 0;
  `balance` money default 0 (derived/maintained); `credit_limit` money null;
  `is_active` bool.
- **Unique:** `(company, name_ar)` (or a `code`); TRN not unique but warn if blank on VAT sale.
- **Indexes:** `(company, is_active)`, `(company, balance)`.
- **Audit:** edit opening balance, increase credit limit = sensitive actions.

## CustomerSpecialPrice
- **Purpose:** customer-specific price for a product (active until changed).
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `customer_id` FK; `product_id` FK; `price` money;
  `price_type` enum `kg|piece|carton|tray`; `is_active` bool; `effective_from` date.
- **Unique:** `(customer, product)` where `is_active` (latest active).

## CustomerFreeProduct
- **Purpose:** free-product agreement (qty given free under agreement/permission).
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `customer_id` FK; `product_id` FK; `free_qty`;
  `unit` enum `kg|piece|carton`; `notes` text null; `is_active` bool.

---

# App: suppliers

## Supplier
- **Tenant:** yes (company_id). **Soft delete:** `is_active`.
- **Fields:** id; `company_id`; `name_ar`; `name_en` null; `phone` null; `trn` char null;
  `supplier_type` enum `cash|bank|credit`; `opening_balance` money default 0;
  `balance` money default 0; `is_active` bool.
- **Unique:** `(company, name_ar)` or `code`.
- **Audit:** edit opening balance = sensitive action.

## SupplierAgreement
- **Purpose:** default terms per supplier.
- **Tenant:** yes (company_id). 1—1 (or latest) with Supplier.
- **Fields:** id; `company_id`; `supplier_id` FK; `payment_terms` char null;
  `default_slaughter_deduction` decimal null; `default_transport_deduction` money null;
  `default_vat_behavior` enum `taxable|exempt|inherit` null;
  `default_pieces_per_carton` int null; `notes` text null.

## SupplierSpecialPrice
- **Purpose:** supplier-specific purchase price per product (active until changed).
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `supplier_id` FK; `product_id` FK; `price` money;
  `price_type` enum `kg|piece|carton|tray`; `is_active` bool; `effective_from` date.
- **Unique:** `(supplier, product)` where `is_active`.

---

# App: sales

## SalesInvoice
- **Purpose:** sales document; draft → approved lifecycle with side effects on approval.
- **Tenant:** yes (company_id). **Soft delete:** no — use `status` (incl. `cancelled`).
- **Fields:**
  | field | type | req | notes |
  | --- | --- | --- | --- |
  | id | BigAuto | yes | |
  | company_id | FK | yes | |
  | number | char(32) | yes | from NumberingSequence; **unique per company** |
  | date | date | yes | |
  | customer_id | FK→Customer | yes | |
  | status | enum `draft|approved|partial|paid|cancelled|adjusted` | yes | default `draft` |
  | payment_method | enum `cash|bank|credit` | yes | |
  | subtotal | money | yes | sum of line amounts |
  | vat_amount | money | yes | |
  | total | money | yes | subtotal + vat − doc discount |
  | paid_amount | money | yes | default 0 |
  | remaining | money | yes | total − paid |
  | vat_applied | bool | yes | can be disabled w/ permission+reason |
  | total_cartons | int | yes | denormalized |
  | total_kg | decimal | yes | denormalized |
  | cogs_total | money | no | FIFO cost of goods sold (set on approval) |
  | notes | text | no | |
  | created_by_id | FK→User | yes | |
  | approved_by_id | FK→User | no | |
  | approved_at | datetime | no | |
  | cancelled_by_id / cancelled_at / cancel_reason | | no | reversal audit |
- **Unique:** `(company, number)`.
- **Indexes:** `(company, status)`, `(company, date)`, `(company, customer)`.
- **Side effects on approve:** consume FIFO layers, create `StockMovement` (out), set
  `cogs_total`, update `Customer.balance` by `remaining`. **Cancel:** restore layers,
  reverse balance. Both audited.

## SalesInvoiceLine
- **Tenant:** yes (company_id, via invoice).
- **Fields:** id; `company_id`; `invoice_id` FK (CASCADE within doc); `product_id` FK(PROTECT);
  `cartons` int; `pieces` int; `kg` decimal; `unit_price` money; `price_type` enum
  `kg|piece|carton|tray`; `amount` money; `is_free` bool default false;
  `kg_override` bool; `price_override` bool; `vat_amount` money;
  `line_cogs` money null (FIFO cost allocated on approval).
- **Indexes:** `invoice_id`, `product_id`.
- **Audit:** `price_override`, `kg_override`, free product = sensitive flags w/ reason.

---

# App: quotations

## Quotation
- **Purpose:** price offer; never affects stock or balances.
- **Tenant:** yes (company_id). **Lifecycle via** `status`.
- **Fields:** id; `company_id`; `number` (**unique per company**); `date`; `customer_id` FK;
  `expiry_date` date; `status` enum `draft|sent|accepted|rejected|expired|cancelled|converted`;
  `subtotal`; `vat_amount`; `total`; `vat_applied` bool; `notes` text null;
  `converted_invoice_id` FK→SalesInvoice null; `created_by_id` FK.
- **Unique:** `(company, number)`.
- **Indexes:** `(company, status)`, `(company, expiry_date)`.
- **Side effects:** convert → creates a `SalesInvoice` **draft** (stock re-checked at
  approval, not at conversion).

## QuotationLine
- **Tenant:** yes (company_id, via quotation).
- **Fields:** id; `company_id`; `quotation_id` FK(CASCADE); `product_id` FK(PROTECT);
  `cartons`; `pieces`; `kg`; `unit_price`; `price_type`; `amount`; `vat_amount`.

---

# App: purchases

## PurchaseInvoice
- **Purpose:** purchase document; draft → approved adds stock + FIFO layers on approval.
- **Tenant:** yes (company_id). **Lifecycle via** `status`.
- **Fields:** id; `company_id`; `number` (**unique per company**); `supplier_invoice_no`
  char null; `date`; `supplier_id` FK; `status` enum
  `draft|approved|partial|paid|cancelled|adjusted`; `payment_method` enum
  `cash|bank|credit`; `subtotal`; `vat_amount`; `total`; `paid_amount`; `remaining`;
  `vat_applied` bool; `total_cartons`; `total_kg`; `attachment_id` FK→FileAttachment null
  (uploaded original invoice); `created_by_id`; `approved_by_id`/`approved_at`;
  `cancelled_by_id`/`cancelled_at`/`cancel_reason`.
- **Unique:** `(company, number)`.
- **Indexes:** `(company, status)`, `(company, date)`, `(company, supplier)`.
- **Side effects on approve:** create `StockLayer`(s) + `StockMovement`(in), update
  `Supplier.balance` by `remaining`. **Cancel:** blocked if any created layer already
  consumed by a sale; else reverse layers + balance. Audited.

## PurchaseInvoiceLine
- **Fields:** id; `company_id`; `invoice_id` FK(CASCADE); `product_id` FK(PROTECT);
  `cartons`; `pieces`; `kg`; `unit_cost` money; `cost_type` enum `kg|piece|carton|tray`;
  `amount` money; `vat_amount` money.

## PurchaseAdjustment
- **Purpose:** distinguish purchase-related adjustments by accounting effect.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `purchase_invoice_id` FK; `adjustment_type` enum
  `deduct_supplier_payable|add_to_inventory_cost|normal_expense|commercial_deduction`;
  `amount` money; `description` text null; `linked_expense_id` FK→Expense null;
  `created_by_id`.
- **Side effects:** depends on type — adjust supplier balance, add to inventory cost
  layers, or create an Expense. Audited.

---

# App: inventory

## InventoryBalance
- **Purpose:** fast current on-hand per product (cartons/pieces/kg). UI shows this.
- **Tenant:** yes (company_id). 1—1 per product.
- **Fields:** id; `company_id`; `product_id` FK (**unique per company**);
  `cartons` int default 0; `pieces` int default 0; `kg` decimal default 0;
  `avg_or_last_cost` money null (display only — true cost is FIFO).
- **Unique:** `(company, product)`.
- **Invariant:** never negative.

## StockLayer  *(FIFO cost layer)*
- **Purpose:** a remaining-quantity cost layer created by an approved purchase (or positive
  adjustment). Consumed oldest-first.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `product_id` FK; `source_type` enum
  `purchase|adjustment|opening`; `source_id` int (e.g. purchase line id);
  `unit_cost_kg` money (normalized cost per kg) **and/or** per-unit cost fields;
  `qty_kg_received` decimal; `qty_kg_remaining` decimal; `cartons_received`/`remaining` int;
  `received_at` datetime; `is_depleted` bool.
- **Indexes:** `(company, product, received_at)`, `(company, product, is_depleted)`.
- **Consumption:** `select_for_update()` ordered by `received_at` ASC.

## StockMovement  *(ledger; every change is auditable)*
- **Purpose:** immutable record of every inventory change.
- **Tenant:** yes (company_id). Append-only.
- **Fields:** id; `company_id`; `product_id` FK; `movement_type` enum
  `purchase_in|sale_out|adjustment_in|adjustment_out|stocktaking_in|stocktaking_out|cancel_reversal`;
  `cartons` int; `pieces` int; `kg` decimal; `unit_cost_kg` money null;
  `reference_type` char; `reference_id` int; `layer_id` FK→StockLayer null;
  `created_by_id`; `reason` text null; `created_at`.
- **Indexes:** `(company, product, created_at)`, `(reference_type, reference_id)`.

## StockAdjustment
- **Purpose:** manual stock adjustment by authorized user (sensitive).
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `product_id` FK; `direction` enum `increase|decrease`;
  `cartons`/`pieces`/`kg`; `reason` text (**required**); `created_by_id`; `created_at`.
- **Side effects:** creates `StockMovement` (+ layer on increase / consumes on decrease).
  Audited with reason.

## StocktakingSession
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `started_at`; `status` enum `open|applied|cancelled`;
  `applied_by_id` FK null; `applied_at` null; `notes` text null.

## StocktakingLine
- **Fields:** id; `company_id`; `session_id` FK(CASCADE); `product_id` FK;
  `system_cartons`/`system_kg` (snapshot); `counted_cartons`/`counted_kg`;
  `diff_cartons`/`diff_kg` (computed).
- **Side effects on apply:** create adjustment `StockMovement` per non-zero diff
  (sensitive action — apply stocktaking differences).

---

# App: payments

## PaymentMovement  *(collection / payment / refund)*
- **Purpose:** one financial movement; mirrors frontend `PaymentMovement`.
- **Tenant:** yes (company_id). **Lifecycle:** `is_cancelled` + cancel audit.
- **Fields:**
  | field | type | req | notes |
  | --- | --- | --- | --- |
  | id | BigAuto | yes | |
  | company_id | FK | yes | |
  | movement_type | enum `customer_collection|supplier_payment|customer_refund|supplier_refund` | yes | |
  | party_type | enum `customer|supplier` | yes | |
  | customer_id | FK null | cond | for customer movements |
  | supplier_id | FK null | cond | for supplier movements |
  | amount | money | yes | |
  | method | enum `cash|bank|cheque|other` | yes | |
  | date | date | yes | |
  | reference | char null | no | cheque no / transfer ref |
  | discount_amount | money | no | collection discount (sensitive) |
  | notes | text | no | |
  | created_by_id | FK | yes | |
  | is_cancelled | bool | yes | default false |
  | cancelled_by_id/cancelled_at/cancel_reason | | no | |
- **Indexes:** `(company, date)`, `(company, party_type)`, `(company, movement_type)`.
- **Side effects:** updates customer/supplier balance and (via allocations) invoice
  paid/remaining. Cancel reverses balance effects (sensitive, reason required).

## PaymentAllocation
- **Purpose:** allocate a movement to specific invoice(s) or leave on-account.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `payment_id` FK(CASCADE); `target_type` enum
  `sales_invoice|purchase_invoice|on_account`; `target_id` int null; `amount` money.
- **Indexes:** `(target_type, target_id)`.

## Receipt
- **Purpose:** printable receipt document for a payment movement.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `number` (**unique per company**, from NumberingSequence);
  `payment_id` FK→PaymentMovement (1—1); `issued_at`; `pdf_id` FK→FileAttachment null;
  `is_cancelled` bool.
- **Unique:** `(company, number)`.

---

# App: expenses

## ExpenseCategory
- **Tenant:** yes (company_id). **Soft delete:** `is_active`.
- **Fields:** id; `company_id`; `name_ar`; `name_en`; `is_active`.

## Expense
- **Purpose:** an expense affecting daily/monthly profit; may be purchase-linked.
- **Tenant:** yes (company_id). **Lifecycle:** `is_cancelled` + audit.
- **Fields:** id; `company_id`; `number` (**unique per company**); `category_id` FK null;
  `amount` money; `date` date; `method` enum `cash|bank|cheque|other`; `note` text null;
  `expense_kind` enum `normal|purchase_linked`;
  `purchase_invoice_id` FK→PurchaseInvoice null;
  `purchase_effect` enum `add_to_inventory_cost|normal_expense|deduct_supplier_payable` null;
  `recurring_id` FK→RecurringExpense null; `created_by_id`;
  `is_cancelled` bool; `cancelled_by_id/cancelled_at/cancel_reason`.
- **Indexes:** `(company, date)`, `(company, category)`.
- **Audit:** cancellation requires reason.

## RecurringExpense
- **Purpose:** template generating expected expenses on a cadence.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `category_id` FK null; `amount` money; `cadence` enum
  `weekly|monthly|yearly`; `next_run_date` date; `is_active` bool; `note` text null.

---

# App: tax

## VatSettings
- **Purpose:** per-company VAT configuration (1—1).
- **Tenant:** yes (company_id, **unique**).
- **Fields:** id; `company_id` (1—1); `vat_rate` decimal default 5.00;
  `vat_enabled` bool default true; `company_trn` char null.
- **Audit:** changing rate / disabling VAT = sensitive action (reason + audit).

## VatRecord
- **Purpose:** per-document VAT line for reporting (sales/purchase).
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `source_type` enum `sales|purchase`; `source_id` int;
  `taxable_amount` money; `vat_amount` money; `rate` decimal; `date` date;
  `counterparty_trn` char null.
- **Indexes:** `(company, source_type, date)`.

## TaxCreditNote  *(placeholder for later)*
- **Purpose:** schema seam for future credit notes; not fully implemented now.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `number` null; `source_invoice_id` int null;
  `party_type` enum `customer|supplier`; `amount` money; `vat_amount` money;
  `reason` text null; `status` enum `draft|issued|cancelled`; `created_by_id`.

---

# App: reports

## ReportSnapshot  *(optional materialized summary placeholder)*
- **Purpose:** cache expensive aggregates (daily/monthly profit, dashboard KPIs).
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `report_key` char (e.g. `dashboard_summary`,
  `daily_profit`); `period` char (date/range key); `payload` JSON; `generated_at`.
- **Unique:** `(company, report_key, period)`.
- **Note:** reports can also be computed on-demand via selectors; snapshots are an
  optimization, not the source of truth.

---

# App: audit

## AuditLog  *(append-only)*
- **Purpose:** immutable trail of state changes + sensitive actions.
- **Tenant:** yes (company_id) for tenant events; `company=NULL` for super-admin events.
- **Fields:** id; `company_id` null; `actor_id` FK→User null; `action` char/enum
  (e.g. `sales.approve`, `vat.disable`, `user.permission_change`); `entity_type` char;
  `entity_id` int null; `reason` text null (**required when permission.is_sensitive**);
  `changes` JSON null (before/after); `ip` inet/char null; `created_at`.
- **Indexes:** `(company, created_at)`, `(entity_type, entity_id)`, `action`.
- **Immutability:** never updated/deleted by app code; DB-level enforcement is an
  OPEN QUESTION.

---

# App: documents

## FileAttachment
- **Purpose:** uploaded files + generated PDFs, attached to any entity.
- **Tenant:** yes (company_id).
- **Fields:** id; `company_id`; `file` (FileField/path or S3 key); `original_name`;
  `content_type`; `size_bytes`; `entity_type` char; `entity_id` int;
  `kind` enum `upload|generated_pdf|logo|template_asset`; `uploaded_by_id` FK null;
  `created_at`.
- **Indexes:** `(company, entity_type, entity_id)`.

---

## Index & constraint summary (high-value)

- Every tenant table: index on `company_id` (+ composite with the most-filtered column).
- Unique-per-company: `Product.code`, `SalesInvoice.number`, `PurchaseInvoice.number`,
  `Quotation.number`, `Receipt.number`, `Expense.number`, `NumberingSequence.doc_type`,
  `InventoryBalance.product`, `VatSettings.company`, `CompanySettings.company`.
- Global unique: `Company.subdomain`, `User.email`, `Plan.code`, `PermissionCatalog.code`.
- FIFO read path: `StockLayer (company, product, received_at) WHERE NOT is_depleted`.
- Ledger: `StockMovement (company, product, created_at)`.

## Soft-delete / lifecycle summary

- **Master data** (Company, User, Product, Category, Customer, Supplier, ExpenseCategory,
  PrintTemplate): `is_active` flag — disable, never hard delete when referenced.
- **Transactional documents** (Sales/Purchase invoices, Quotations, Payments, Expenses,
  Receipts): status lifecycle incl. `cancelled`/`is_cancelled` — reversed, not deleted.
- **Ledger** (StockMovement, AuditLog, VatRecord): append-only, never mutated.
