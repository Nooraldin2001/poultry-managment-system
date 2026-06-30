# Poultry Hero — Entity Relationship Diagrams (Mermaid)

> Text-based ERD using Mermaid `erDiagram`. Split into focused diagrams for
> readability; together they describe the full schema in `DATABASE_SCHEMA.md`.
> `COMPANY` is the tenant root — almost every tenant-owned entity has an implicit
> `company_id` FK (shown explicitly only where it aids clarity).

---

## 1. SaaS / tenant / users / permissions layer

```mermaid
erDiagram
    COMPANY ||--|| COMPANY_SUBSCRIPTION : has
    COMPANY ||--|| COMPANY_SETTINGS : has
    COMPANY ||--|| VAT_SETTINGS : has
    COMPANY ||--o{ SUBSCRIPTION_PAYMENT : receives
    COMPANY ||--o{ USER : employs
    COMPANY ||--o{ NUMBERING_SEQUENCE : configures
    COMPANY ||--o{ PRINT_TEMPLATE : configures
    COMPANY ||--o{ MODULE_ACCESS : gates

    PLAN ||--o{ COMPANY_SUBSCRIPTION : referenced_by

    USER ||--o{ USER_PERMISSION_OVERRIDE : customized_by
    PERMISSION_CATALOG ||--o{ ROLE_PERMISSION_DEFAULT : seeds
    PERMISSION_CATALOG ||--o{ USER_PERMISSION_OVERRIDE : overridden_in

    COMPANY {
        bigint id PK
        string name_ar
        string name_en
        string subdomain UK
        string status
        json enabled_modules
        bool is_active
    }
    PLAN {
        bigint id PK
        string code UK
        decimal monthly_price
        decimal yearly_price
        int user_limit
    }
    COMPANY_SUBSCRIPTION {
        bigint id PK
        bigint company_id FK
        bigint plan_id FK
        string status
        date renewal_date
        int user_limit
        decimal outstanding_amount
        decimal total_paid
    }
    SUBSCRIPTION_PAYMENT {
        bigint id PK
        bigint company_id FK
        decimal amount
        string method
        date paid_on
    }
    USER {
        bigint id PK
        string email UK
        bigint company_id FK
        string role
        bool is_superuser
        bool is_active
    }
    PERMISSION_CATALOG {
        bigint id PK
        string code UK
        bool is_sensitive
    }
    ROLE_PERMISSION_DEFAULT {
        bigint id PK
        string role
        bigint permission_id FK
        bool allowed
    }
    USER_PERMISSION_OVERRIDE {
        bigint id PK
        bigint company_id FK
        bigint user_id FK
        bigint permission_id FK
        bool allowed
    }
    COMPANY_SETTINGS {
        bigint id PK
        bigint company_id FK
        string trn
    }
    NUMBERING_SEQUENCE {
        bigint id PK
        bigint company_id FK
        string doc_type
        int next_number
    }
    PRINT_TEMPLATE {
        bigint id PK
        bigint company_id FK
        string doc_type
    }
    MODULE_ACCESS {
        bigint id PK
        bigint company_id FK
        string module
        bool enabled
    }
    VAT_SETTINGS {
        bigint id PK
        bigint company_id FK
        decimal vat_rate
        bool vat_enabled
    }
```

---

## 2. Products / inventory / FIFO layer

```mermaid
erDiagram
    COMPANY ||--o{ CATEGORY : owns
    COMPANY ||--o{ PRODUCT : owns
    CATEGORY ||--o{ PRODUCT : groups

    PRODUCT ||--|| INVENTORY_BALANCE : has
    PRODUCT ||--o{ STOCK_LAYER : has
    PRODUCT ||--o{ STOCK_MOVEMENT : logs
    PRODUCT ||--o{ STOCK_ADJUSTMENT : adjusted_by
    PRODUCT ||--o{ STOCKTAKING_LINE : counted_in

    STOCK_LAYER ||--o{ STOCK_MOVEMENT : consumed_by
    STOCKTAKING_SESSION ||--o{ STOCKTAKING_LINE : contains

    PRODUCT {
        bigint id PK
        bigint company_id FK
        string code UK
        string name_ar
        string name_en
        string product_type
        int weight_grams
        bool is_variable_weight
        int default_pieces_per_carton
        decimal sales_price
        string sales_price_type
        bool is_vat_taxable
        bool is_active
    }
    CATEGORY {
        bigint id PK
        bigint company_id FK
        string name_en
        bool is_active
    }
    INVENTORY_BALANCE {
        bigint id PK
        bigint company_id FK
        bigint product_id FK
        int cartons
        int pieces
        decimal kg
    }
    STOCK_LAYER {
        bigint id PK
        bigint company_id FK
        bigint product_id FK
        string source_type
        int source_id
        decimal unit_cost_kg
        decimal qty_kg_received
        decimal qty_kg_remaining
        datetime received_at
        bool is_depleted
    }
    STOCK_MOVEMENT {
        bigint id PK
        bigint company_id FK
        bigint product_id FK
        string movement_type
        decimal kg
        int cartons
        bigint layer_id FK
        string reference_type
        int reference_id
        datetime created_at
    }
    STOCK_ADJUSTMENT {
        bigint id PK
        bigint company_id FK
        bigint product_id FK
        string direction
        text reason
    }
    STOCKTAKING_SESSION {
        bigint id PK
        bigint company_id FK
        string status
    }
    STOCKTAKING_LINE {
        bigint id PK
        bigint company_id FK
        bigint session_id FK
        bigint product_id FK
        decimal diff_kg
    }
```

---

## 3. Customers / sales / quotations / payments

```mermaid
erDiagram
    COMPANY ||--o{ CUSTOMER : owns
    CUSTOMER ||--o{ CUSTOMER_SPECIAL_PRICE : has
    CUSTOMER ||--o{ CUSTOMER_FREE_PRODUCT : has
    CUSTOMER ||--o{ SALES_INVOICE : billed_on
    CUSTOMER ||--o{ QUOTATION : offered
    CUSTOMER ||--o{ PAYMENT_MOVEMENT : pays

    PRODUCT ||--o{ CUSTOMER_SPECIAL_PRICE : priced_in
    PRODUCT ||--o{ SALES_INVOICE_LINE : sold_as
    PRODUCT ||--o{ QUOTATION_LINE : quoted_as

    SALES_INVOICE ||--o{ SALES_INVOICE_LINE : contains
    QUOTATION ||--o{ QUOTATION_LINE : contains
    QUOTATION ||--o| SALES_INVOICE : converts_to

    PAYMENT_MOVEMENT ||--o{ PAYMENT_ALLOCATION : split_into
    PAYMENT_MOVEMENT ||--o| RECEIPT : printed_as
    SALES_INVOICE ||--o{ PAYMENT_ALLOCATION : settled_by

    CUSTOMER {
        bigint id PK
        bigint company_id FK
        string name_ar
        string customer_type
        decimal opening_balance
        decimal balance
        decimal credit_limit
        string trn
        bool is_active
    }
    CUSTOMER_SPECIAL_PRICE {
        bigint id PK
        bigint company_id FK
        bigint customer_id FK
        bigint product_id FK
        decimal price
        bool is_active
    }
    CUSTOMER_FREE_PRODUCT {
        bigint id PK
        bigint company_id FK
        bigint customer_id FK
        bigint product_id FK
        decimal free_qty
    }
    SALES_INVOICE {
        bigint id PK
        bigint company_id FK
        string number UK
        date date
        bigint customer_id FK
        string status
        string payment_method
        decimal total
        decimal paid_amount
        decimal remaining
        decimal cogs_total
        bool vat_applied
    }
    SALES_INVOICE_LINE {
        bigint id PK
        bigint company_id FK
        bigint invoice_id FK
        bigint product_id FK
        int cartons
        decimal kg
        decimal unit_price
        decimal amount
        bool is_free
        decimal line_cogs
    }
    QUOTATION {
        bigint id PK
        bigint company_id FK
        string number UK
        bigint customer_id FK
        date expiry_date
        string status
        bigint converted_invoice_id FK
    }
    QUOTATION_LINE {
        bigint id PK
        bigint company_id FK
        bigint quotation_id FK
        bigint product_id FK
        decimal kg
        decimal amount
    }
    PAYMENT_MOVEMENT {
        bigint id PK
        bigint company_id FK
        string movement_type
        string party_type
        bigint customer_id FK
        bigint supplier_id FK
        decimal amount
        string method
        decimal discount_amount
        bool is_cancelled
    }
    PAYMENT_ALLOCATION {
        bigint id PK
        bigint company_id FK
        bigint payment_id FK
        string target_type
        int target_id
        decimal amount
    }
    RECEIPT {
        bigint id PK
        bigint company_id FK
        string number UK
        bigint payment_id FK
        bool is_cancelled
    }
```

---

## 4. Suppliers / purchases / adjustments / payments

```mermaid
erDiagram
    COMPANY ||--o{ SUPPLIER : owns
    SUPPLIER ||--o| SUPPLIER_AGREEMENT : has
    SUPPLIER ||--o{ SUPPLIER_SPECIAL_PRICE : has
    SUPPLIER ||--o{ PURCHASE_INVOICE : supplies
    SUPPLIER ||--o{ PAYMENT_MOVEMENT : paid

    PRODUCT ||--o{ SUPPLIER_SPECIAL_PRICE : priced_in
    PRODUCT ||--o{ PURCHASE_INVOICE_LINE : purchased_as

    PURCHASE_INVOICE ||--o{ PURCHASE_INVOICE_LINE : contains
    PURCHASE_INVOICE ||--o{ PURCHASE_ADJUSTMENT : adjusted_by
    PURCHASE_INVOICE ||--o| FILE_ATTACHMENT : original_invoice
    PURCHASE_ADJUSTMENT ||--o| EXPENSE : may_create

    SUPPLIER {
        bigint id PK
        bigint company_id FK
        string name_ar
        string supplier_type
        decimal opening_balance
        decimal balance
        string trn
        bool is_active
    }
    SUPPLIER_AGREEMENT {
        bigint id PK
        bigint company_id FK
        bigint supplier_id FK
        decimal default_slaughter_deduction
        decimal default_transport_deduction
        int default_pieces_per_carton
    }
    SUPPLIER_SPECIAL_PRICE {
        bigint id PK
        bigint company_id FK
        bigint supplier_id FK
        bigint product_id FK
        decimal price
        bool is_active
    }
    PURCHASE_INVOICE {
        bigint id PK
        bigint company_id FK
        string number UK
        string supplier_invoice_no
        bigint supplier_id FK
        string status
        string payment_method
        decimal total
        decimal paid_amount
        decimal remaining
        bigint attachment_id FK
    }
    PURCHASE_INVOICE_LINE {
        bigint id PK
        bigint company_id FK
        bigint invoice_id FK
        bigint product_id FK
        int cartons
        decimal kg
        decimal unit_cost
        decimal amount
    }
    PURCHASE_ADJUSTMENT {
        bigint id PK
        bigint company_id FK
        bigint purchase_invoice_id FK
        string adjustment_type
        decimal amount
        bigint linked_expense_id FK
    }
    EXPENSE {
        bigint id PK
        bigint company_id FK
        decimal amount
    }
    FILE_ATTACHMENT {
        bigint id PK
        bigint company_id FK
        string entity_type
        int entity_id
    }
```

---

## 5. Expenses / tax / audit / documents

```mermaid
erDiagram
    COMPANY ||--o{ EXPENSE_CATEGORY : owns
    COMPANY ||--o{ EXPENSE : records
    COMPANY ||--o{ RECURRING_EXPENSE : schedules
    COMPANY ||--o{ VAT_RECORD : reports
    COMPANY ||--o{ TAX_CREDIT_NOTE : may_issue
    COMPANY ||--o{ AUDIT_LOG : tracked_by
    COMPANY ||--o{ FILE_ATTACHMENT : stores
    COMPANY ||--o{ REPORT_SNAPSHOT : caches

    EXPENSE_CATEGORY ||--o{ EXPENSE : classifies
    RECURRING_EXPENSE ||--o{ EXPENSE : generates
    USER ||--o{ AUDIT_LOG : performs

    EXPENSE_CATEGORY {
        bigint id PK
        bigint company_id FK
        string name_en
        bool is_active
    }
    EXPENSE {
        bigint id PK
        bigint company_id FK
        string number UK
        bigint category_id FK
        decimal amount
        date date
        string expense_kind
        bigint purchase_invoice_id FK
        string purchase_effect
        bool is_cancelled
    }
    RECURRING_EXPENSE {
        bigint id PK
        bigint company_id FK
        decimal amount
        string cadence
        date next_run_date
        bool is_active
    }
    VAT_RECORD {
        bigint id PK
        bigint company_id FK
        string source_type
        int source_id
        decimal taxable_amount
        decimal vat_amount
        decimal rate
        date date
    }
    TAX_CREDIT_NOTE {
        bigint id PK
        bigint company_id FK
        string party_type
        decimal amount
        string status
    }
    AUDIT_LOG {
        bigint id PK
        bigint company_id FK
        bigint actor_id FK
        string action
        string entity_type
        int entity_id
        text reason
        json changes
        datetime created_at
    }
    REPORT_SNAPSHOT {
        bigint id PK
        bigint company_id FK
        string report_key
        string period
        json payload
    }
    FILE_ATTACHMENT {
        bigint id PK
        bigint company_id FK
        string kind
        string entity_type
        int entity_id
    }
    USER {
        bigint id PK
        bigint company_id FK
        string email UK
    }
```

---

## Relationship notes

- **Tenant isolation:** all entities except `COMPANY`, `PLAN`, `PERMISSION_CATALOG`,
  `ROLE_PERMISSION_DEFAULT`, and `SUBSCRIPTION_PAYMENT`/`COMPANY_SUBSCRIPTION` (which are
  global but reference one company) carry `company_id`.
- **FIFO:** `PURCHASE_INVOICE` (on approval) creates `STOCK_LAYER` rows; `SALES_INVOICE`
  (on approval) consumes them oldest-first, recording `STOCK_MOVEMENT` rows linked to the
  consumed `layer_id` and setting `line_cogs`.
- **Payments:** `PAYMENT_MOVEMENT` → `PAYMENT_ALLOCATION` targets either a sales invoice,
  a purchase invoice, or `on_account`; `RECEIPT` is the printable artifact.
- **Polymorphic refs:** `STOCK_MOVEMENT.reference_*`, `PAYMENT_ALLOCATION.target_*`,
  `VAT_RECORD.source_*`, `AUDIT_LOG.entity_*`, and `FILE_ATTACHMENT.entity_*` use
  `(type, id)` pairs rather than hard FKs (kept simple for Mermaid).
