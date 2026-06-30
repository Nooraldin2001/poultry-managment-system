# Phase 2 Implementation Notes — Product Master, Customers, Suppliers

This phase delivers the **data foundations** that later sales, purchases,
inventory, payments, and reports will depend on. No transactional/business
documents (sales, purchases, inventory, payments, VAT/reports) are implemented
yet — only master data, account ledgers (opening balance foundation), special
pricing, agreements, and credit-limit tracking.

Built consistently with the Phase 0–1 style: `TenantOwnedModel` base, DRF
serializers/viewsets/services, `/api/v1/tenant/` URLs, permission catalog +
per-user overrides, and the append-only audit foundation.

---

## Apps created

| App | Purpose |
| --- | --- |
| `apps.products` | Product master + categories, pricing/quantity helpers |
| `apps.customers` | Customer accounts, ledger, special prices, free-product agreements, credit-limit changes |
| `apps.suppliers` | Supplier accounts, ledger, special prices, agreements |

A reusable `apps.core.viewsets.TenantScopedViewSet` was added (company-scoped
queryset + per-action permission map), plus shared enums in
`apps.core.enums` (`PriceType`, `Unit`, `PaymentMethod`).

---

## Models created

### products
- **ProductCategory** — `unique(company, code)`, `unique(company, name_ar)`.
- **Product** — full product master; `unique(company, sku)`; indexes on
  `(company, product_type)`, `(company, is_active)`, `(company, category)`.
  Validation in `clean()`: fixed-weight requires positive `weight_grams` +
  `default_pieces_per_carton`; moving-weight default weight must be ≥ 1550g;
  non-negative prices. Computed helpers: `carton_weight_kg`,
  `calculate_pieces`, `calculate_kg`, `calculate_line_amount`
  (pure functions in `products/pricing.py`).

### customers
- **Customer** — accounts with `opening_balance(_type)`, `current_balance`,
  `credit_limit`, credit controls; conditional `unique(company, trn)` when TRN
  is non-blank; `credit_status` computed (`clear`/`near_limit`/`exceeded`).
- **CustomerLedgerEntry** — append-only (overrides `save`/`delete`).
- **CustomerSpecialPrice** — partial unique constraint: one **active** price per
  `(company, customer, product, price_type)`.
- **CustomerFreeProductAgreement** — always/when-selected/min-amount/min-qty.
- **CustomerCreditLimitChange** — audit trail of limit changes.

### suppliers
- **Supplier** — accounts with `opening_balance(_type)`, `current_balance`,
  `default_payment_method`, `track_balance`; `balance_status` computed
  (`clear`/`payable`/`credit`).
- **SupplierLedgerEntry** — append-only.
- **SupplierSpecialPrice** — one **active** price per `(company, supplier, product, price_type)`.
- **SupplierAgreement** — typed agreements; `is_financial` flag drives
  reason-required auditing.

### Ledger balance conventions (documented)
- **Customer:** `current_balance = Σdebit − Σcredit`. Positive ⇒ customer owes us.
  - `customer_owes_us` → debit; `we_owe_customer` → credit.
- **Supplier:** `current_balance = Σcredit − Σdebit`. Positive ⇒ we owe supplier (payable).
  - `we_owe_supplier` → credit; `supplier_owes_us` → debit.
- **Opening balance type `zero`** creates **no** ledger entry.
- Editing opening balance after creation appends a correcting `opening_balance`
  entry (ledger stays append-only) and **requires a reason** + audit log.

---

## Endpoints created (all under `/api/v1/tenant/`)

### Products
- `GET/POST product-categories/`, `GET/PATCH product-categories/{id}/`
- `GET/POST products/`, `GET/PATCH products/{id}/`
- `POST products/{id}/disable/` (reason required), `POST products/{id}/reactivate/`
- `GET products/{id}/prices/`, `GET products/{id}/usage/` (placeholder)

### Customers
- `GET/POST customer-categories/`
- `GET/POST customers/`, `GET/PATCH customers/{id}/`
- `POST customers/{id}/disable/`, `POST customers/{id}/reactivate/`
- `GET customers/{id}/ledger/`, `GET customers/{id}/statement/`
- `POST customers/{id}/opening-balance/` *(added; reason required)*
- `POST customers/{id}/credit-limit/`
- `GET/POST customers/{id}/special-prices/`, `PATCH customers/{id}/special-prices/{price_id}/`
- `GET/POST customers/{id}/free-products/`, `PATCH customers/{id}/free-products/{agreement_id}/`

### Suppliers
- `GET/POST supplier-categories/`
- `GET/POST suppliers/`, `GET/PATCH suppliers/{id}/`
- `POST suppliers/{id}/disable/`, `POST suppliers/{id}/reactivate/`
- `GET suppliers/{id}/ledger/`, `GET suppliers/{id}/statement/`
- `POST suppliers/{id}/opening-balance/` *(added; reason required)*
- `GET/POST suppliers/{id}/special-prices/`, `PATCH suppliers/{id}/special-prices/{price_id}/`
- `GET/POST suppliers/{id}/agreements/`, `PATCH suppliers/{id}/agreements/{agreement_id}/`

All endpoints filter by `request.user.company`; tenant users cannot reach other
companies' data (404). Super Admin users are blocked (these are tenant business
endpoints — `IsTenantUser`). Filters supported: `is_active`, `category`,
`type`/`product_type`/`customer_type`/`supplier_type`, `search`/`q`
(name/phone/SKU), `has_balance`, `credit_exceeded`, `missing_price`.

---

## Permissions added

Added to `apps/permissions/catalog.py` (re-run `seed_permissions`):

- **products**: `disable`, `export`, `manage_settings`, `view_purchase_cost`
  (in addition to existing `view/create/edit/delete`).
- **customers**: `disable`, `view_balance`, `edit_opening_balance`,
  `set_credit_limit`, `override_credit_limit`, plus multi-segment
  `customers.special_prices.manage`, `customers.free_products.manage`,
  `customers.statement.export`.
- **suppliers**: `disable`, `view_balance`, `edit_opening_balance`, plus
  `suppliers.special_prices.manage`, `suppliers.agreements.manage`,
  `suppliers.statement.export`.

Role defaults:
- **Owner/Admin** — everything (short-circuited in checker).
- **Accountant** — products `view/create/edit` (+ export, view_purchase_cost),
  customers/suppliers `view/create/edit` + `view_balance` + `statement.export`.
  Conservative: **no** opening-balance edit, credit override, or special-price/
  agreement management by default.
- **Cashier/Sales** — `products.view`, `customers.view` only (no suppliers).

---

## Sensitive actions / audit

Reason-required audited actions added to `apps/audit/constants.py`:
`product_price_change`, `product_carton_rule_change`, `product_disable`,
`edit_customer_opening_balance`, `edit_supplier_opening_balance`,
`customer_credit_limit_change`, `customer_special_price_change`,
`supplier_special_price_change`, `supplier_agreement_change` (financial only),
`customer_disable_with_balance`, `supplier_disable_with_balance`.

These write an `AuditLog` row with `previous_value`/`new_value`, module,
reference type/id, and risk level. Non-financial agreement changes and
reactivations are recorded via the low-level `create_audit_log` (no reason).

---

## Seed commands

- `python manage.py seed_product_foundation --company-subdomain <sub>`
  (alias `seed_products`) — 8 product categories + 11 sample products
  (900–1300 GRAM fixed-weight, 1600 GRAM moving, Liver/Gizzard/Heart 500G,
  Wings, Bone).
- `python manage.py seed_customer_supplier_demo --company-subdomain <sub>` —
  customer + supplier categories and sample accounts (مطعم الخليج، سوبر ماركت
  المدينة، مطبخ الإمارات، Prime Fresh Meat LLC; WESTLAND، MNM، مزرعة العين،
  نقل الإمارات), including opening-balance ledger entries.

Seeders are idempotent (`update_or_create` / existence checks).

---

## Tests added (39 new; 89 total, all passing)

- `tests/test_products.py` (11): category/product creation, fixed/moving-weight
  validation, `carton_weight_kg`, negative price, disable-requires-reason,
  reactivate, cross-tenant 404, cashier cannot edit, price-change-requires-reason.
- `tests/test_customers.py` (14): opening-balance both directions, ledger
  creation, zero ⇒ no entry, opening-balance edit requires reason, credit-limit
  requires reason, special price same-company-only, duplicate active special
  price blocked (DB constraint), free-product conditional validation,
  cross-tenant 404, reactivation, disable-with-balance requires reason, audit log.
- `tests/test_suppliers.py` (10): opening-balance both directions + ledger,
  special price same-company, duplicate blocked, agreement create, financial
  agreement requires reason, cross-tenant 404, cashier blocked, audit log.
- `tests/test_phase2_permissions.py` (5): owner manages all, accountant/cashier
  seed defaults, accountant cannot manage special prices, cashier cannot create.

---

## Business rules implemented

- Tenant isolation on every read/write (company-scoped querysets).
- Product validation (fixed/moving weight, prices, minimum stock ≥ 0).
- Opening-balance → ledger with documented debit/credit conventions.
- Append-only ledgers; opening-balance edits create correcting entries + audit.
- One active special price per (party, product, price_type).
- Special price / free product blocked unless product allows it, or Owner/Admin
  overrides with a reason.
- Credit-limit changes audited; permanent vs temporary-for-invoice distinction.
- Disable requires reason for products; for customers/suppliers only when a
  balance exists.

---

## Known limitations

- No transactions yet: `products/{id}/usage/` returns an empty foundation;
  product deletion is intentionally not exposed (soft delete/disable only).
- Special-price/free-product/agreement `product` fields are validated by the
  service (same-company) rather than a queryset-scoped serializer field.
- OpenAPI generation emits graceful-fallback warnings for plain `APIView`s
  (same cosmetic issue noted in Phase 0–1); schema still generates.
- `opening-balance` edit endpoints were added beyond the original endpoint list
  to satisfy the "edit opening balance requires reason" rule.

---

## Recommended next phase

**Phase 3 — Inventory foundation**: balances, stock movements, FIFO cost
layers, stock adjustments, and stocktaking (no negative stock; draft documents
have no side effects; approvals trigger movements).
