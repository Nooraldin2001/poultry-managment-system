# Poultry Hero — Business Rules

> Canonical business logic the backend must enforce. The backend is the source of
> truth; the frontend only mirrors these rules for UX. Where a rule is uncertain it is
> flagged → see `OPEN_QUESTIONS.md`.

---

## 1. SaaS rules

- **Super Admin** creates companies/tenants and the first Tenant Admin user.
- Super Admin configures per company: plan (`basic|pro|enterprise`), status
  (`trial|active|suspended`), monthly price, yearly price, renewal date, enabled modules,
  user limit, and records manual subscription payments.
- SaaS subscription billing is **manual** — no Stripe / online gateway.
- Each manual `SubscriptionPayment` increases `total_paid` and reduces
  `outstanding_amount`; `outstanding_amount` may be set by Super Admin.
- A **suspended** company blocks tenant login/usage (read-only or denied — see
  OPEN_QUESTIONS).
- Super Admin data is global; tenant data is isolated by `company_id`.

## 2. Tenant / user limit rules

- A tenant user belongs to exactly **one** company.
- Active users per company ≤ subscription `user_limit`. **Default plan allows 3 users.**
- Creating/reactivating a user when at the limit is rejected (`400`, plan limit).
- Suspending a user frees a seat; suspend/reactivate is a **sensitive action**.

## 3. Role / permission rules

- Roles: **Owner/Admin**, **Accountant**, **Cashier/Sales** only.
- Permissions resolve as: **module enabled** AND (**per-user override** if set, else
  **role default**).
- Owner/Admin can customize permissions per individual user (sensitive action).
- Sensitive actions require an explicit `reason`, which is stored in the audit log.
- Module availability is driven by the SaaS plan / `enabled_modules`.

## 4. Product rules

- Product types: **fixed weight**, **moving/custom weight**, **by-product**, **part**.
- Fixed weights commonly 400g–1500g; moving/custom weights from 1550g and above.
- Product fields: Arabic name, English name, SKU/code, category, product type, chicken
  weight (grams), default pieces per carton, sales price, sales price type, purchase
  price, purchase price type, minimum stock (cartons/KG), VAT taxable flag, active flag.
- Price types supported: **KG**, **piece**, **carton**, **tray**.
- A product used in any transaction **cannot be deleted** — only **disabled**
  (`is_active=false`).
- SKU/code is **unique per company**.

## 5. Carton / KG / piece calculation rules

For **fixed weight** products:

```
pieces          = cartons × pieces_per_carton
kg              = pieces × weight_grams ÷ 1000
line_amount     = kg × price_per_kg            (when pricing by KG)
```

Pricing by other units:

```
by piece   : line_amount = pieces  × price_per_piece
by carton  : line_amount = cartons × price_per_carton
by tray    : line_amount = trays   × price_per_tray
```

For **moving/custom weight** products, KG is entered/weighed directly (not derived from a
fixed grams value); `kg_override = true`.

Inventory always tracks all three units: **cartons, pieces, KG**.

## 6. Sales rules

- A sales invoice can be saved as **draft**; a draft **does not** deduct inventory or
  affect the customer balance.
- Inventory deduction happens **only on approval**, using **FIFO** costing.
- A sale **cannot be approved** if available stock is insufficient (no negative stock).
- A sale cannot be approved if it would exceed the customer **credit limit**, unless an
  Owner/Admin raises the limit (permanently or for this one invoice) — sensitive action.
- Payment methods: cash, bank, credit/on-account, or partial. Remaining amount updates the
  customer account balance.
- Sales can use **customer special prices** and **free products** (if agreement/permission
  allows). Free lines have zero amount but still consume stock.
- VAT can be applied or disabled per settings/permission; disabling is sensitive.
- Cancelling an approved invoice **returns stock** (reverses FIFO consumption) and reverses
  the customer balance effect; requires reason + audit.
- A post-approval monetary discount is recorded as a **collection adjustment**, never by
  silently editing original invoice quantities/amounts.
- Editing sales price, overriding KG, or changing carton/pieces **after draft** are
  sensitive actions (reason + audit).

## 7. Quotation rules

- A quotation **does not** deduct stock or update the customer balance.
- Statuses: draft, sent, accepted, rejected, expired, cancelled, converted.
- A quotation can **convert** to a sales invoice **draft**; stock is checked again only
  when the resulting sales invoice is approved (not at conversion).
- A quotation can **expire** at `expiry_date` (background job flips status).

## 8. Purchase rules

- A purchase invoice can be saved as **draft**; a draft **does not** add stock.
- Stock is added **only after approval**, creating FIFO cost layers.
- Purchase units: KG, piece, carton, or tray.
- Payment methods: cash, bank, credit/on-account, partial. Remaining updates the supplier
  balance.
- VAT and supplier TRN are optional (warn when missing on a VAT purchase).
- The original supplier invoice file can be uploaded/attached.
- Purchase-related adjustments must distinguish their effect:
  - **deduct from supplier payable**,
  - **add to inventory cost**,
  - **normal expense linked to purchase**,
  - **commercial deduction from supplier**.
- Cancelling an approved purchase is **blocked** if any of its created stock layers were
  already (partly) consumed by an approved sale; otherwise it reverses layers + supplier
  balance (sensitive, reason).

> **Phase 4 implementation note.** Purchases are implemented in `apps.purchases`
> (`/api/v1/tenant/purchases/`). **Supplier payable and inventory cost basis are kept
> distinct:** payable = subtotal + VAT − `reduce_supplier_payable` adjustments;
> inventory cost basis = subtotal + `increase_inventory_cost` adjustments (allocated
> across product lines by subtotal to set each line's `unit_cost_per_kg`). Approval posts
> the **gross** payable to the supplier ledger and adds stock via the inventory
> `add_stock()` service; the matching supplier *payment* ledger entry is deferred to the
> payments phase (so a cash purchase shows the gross payable until then). Tray pricing is
> simplified to a pieces basis for now. Cancellation reverses stock only when the
> purchase's FIFO layers are fully intact, else it returns the error _"Cannot cancel
> purchase because stock from this purchase has already been consumed."_

## 9. Inventory / FIFO rules

- One stock location only (no warehouse/muslah split now).
- **Negative stock is never allowed.**
- **FIFO is the locked costing method.** Sales consume the oldest available cost layers
  first.
- UI shows total stock per product; the backend still maintains FIFO cost layers.
- Approved purchases create layers; approved sales consume them and record COGS per line.
- Manual stock adjustments by authorized users update balance + create a `StockMovement`
  (sensitive, reason).
- Stocktaking differences create stock movement records on apply (sensitive).
- **Every** stock movement is auditable (append-only ledger).
- **Phase 3 implementation detail:** FIFO cost is **normalized per KG**
  (`unit_cost_per_kg`); valuation/COGS = `Σ(remaining_kg × unit_cost_per_kg)`.
  Products without meaningful KG fall back to zero cost (documented limitation).
  `InventoryBalance` is created lazily on first movement/adjustment. Consumption
  is blocked if FIFO layers cannot cover the KG the balance claims (integrity
  guard). See `PHASE_3_INVENTORY_IMPLEMENTATION_NOTES.md`.

## 10. Customer account rules

- A customer has an account balance and may have an opening balance.
- A customer may be **cash** or **credit** and may have a **credit limit**.
- Credit limit blocks sale approval when exceeded; Owner/Admin can raise it on the spot,
  permanently or temporarily for one invoice (sensitive).
- Customer **special prices** remain active until changed.
- Customer **free product agreements** are supported.
- Customer statement includes: opening balance, sales invoices, collections, collection
  discounts, sales-returns placeholder, tax-credit-notes placeholder.
- Editing a customer opening balance is sensitive.

## 11. Supplier account rules

- A supplier may have an optional account balance and an opening balance.
- A supplier may be cash, bank, or credit/on-account.
- Supplier **special purchase prices** remain active until changed.
- Supplier statement includes: opening balance, purchase invoices, supplier payments,
  purchase deductions, purchase cancellations, purchase-returns placeholder.
- Supplier agreements store defaults: payment terms, slaughter deduction, transport
  deduction, VAT behavior, pieces per carton, notes.
- Editing a supplier opening balance is sensitive.

## 12. Payment / receipt rules

- A customer collection can be linked to a specific sales invoice or to the general
  customer account (on-account).
- A supplier payment can be linked to a specific purchase invoice or the supplier account.
- Methods: cash, bank transfer, cheque, other. Partial payments supported.
- Customer refund and supplier refund supported (reverse balance direction).
- Receipts must be printable/exportable.
- Cancelling a receipt/payment reverses its balance + invoice-allocation effect and
  requires reason + audit. Collection discounts are sensitive.

## 13. Expense / profit rules

- Daily expenses affect daily profit; monthly expenses affect monthly profit.
- Recurring expenses (weekly/monthly/yearly) are expected expenses generated on cadence.
- Purchase-linked expenses may: add to inventory cost, be a normal expense only, or deduct
  from supplier payable.
- Expense cancellation requires reason + audit and reverses any purchase/supplier effect.

## 14. VAT / tax rules

- UAE VAT default rate is **5%** (configurable per company).
- Company TRN stored in settings; customer/supplier TRN optional but warn when missing on
  taxable documents.
- Track sales VAT, purchase VAT, and a net VAT estimate.
- Disabling VAT or changing the rate requires reason + audit.
- Tax credit note is a placeholder for later; schema must not block adding it.

## 15. Audit / reason rules

- Every state-changing action writes an `AuditLog` (actor, action, entity, before/after,
  timestamp).
- **Sensitive actions** additionally require a non-empty `reason`, persisted in the audit
  entry. Without a reason the action is rejected.
- Audit entries are append-only (never edited/deleted via the application).

### Sensitive actions (require reason + audit)
Edit sales price · edit purchase price · override KG · change carton/pieces after draft ·
approve invoice · cancel sales invoice · cancel purchase invoice · apply collection
discount · increase customer credit limit · edit customer opening balance · edit supplier
opening balance · manual stock adjustment · apply stocktaking differences · change VAT
rate · disable VAT · edit invoice numbering · edit print template · change user
permissions · suspend/reactivate user · export sensitive financial reports · cancel
receipt · cancel expense.

## 16. Cancellation / reversal rules

- Documents are never hard-deleted; they are cancelled and their side effects reversed.
- Sales cancel → restore consumed FIFO layers, reverse customer balance.
- Purchase cancel → reverse layers if unconsumed (else blocked), reverse supplier balance.
- Payment cancel → reverse balance + allocation effects.
- Expense cancel → reverse purchase/supplier linkage effects.
- All reversals create offsetting ledger/movement entries and an audit entry with reason.

## 17. Validation rules

- Money ≥ 0; quantities ≥ 0; computed `kg` consistent with cartons/pieces for fixed-weight
  products (unless `kg_override`).
- Approval requires at least one line and sufficient stock for every line.
- A draft must reference an active customer/supplier and active products.
- Document numbers are assigned from `NumberingSequence` (unique per company, concurrency
  safe).
- TRN warnings (not hard errors) when VAT applies and counterparty TRN is blank.
- Tenant-scoped uniqueness enforced (product code, document numbers, etc.).

## 18. Edge cases

- **Insufficient stock at approval** → reject (`409`); draft remains editable.
- **Partial FIFO consumption across layers** → split COGS across multiple layers.
- **Cancel after partial sale of purchased stock** → block purchase cancel.
- **Credit-limit exactly at boundary** → define inclusive/exclusive (see OPEN_QUESTIONS).
- **Free products + VAT** → define whether free lines are taxable (see OPEN_QUESTIONS).
- **VAT disabled mid-period** → record audit; historical documents keep their VAT.
- **Concurrent approvals on same product** → row-lock layers (`select_for_update`).
- **Moving-weight product** → KG entered directly; cartons/pieces optional.
- **Rounding** → define rounding policy for KG×price and VAT (see OPEN_QUESTIONS).

---

## Formulas (reference)

```
pieces            = cartons × pieces_per_carton
kg                = pieces × weight_grams ÷ 1000
sales_line_amount = kg × price_per_kg                      (KG pricing)
purchase_line_amount:
    by kg     = kg      × cost_per_kg
    by piece  = pieces  × cost_per_piece
    by carton = cartons × cost_per_carton
    by tray   = trays   × cost_per_tray
vat               = taxable_amount × vat_rate
daily_profit      = daily_sales   − daily_purchases   − daily_expenses
monthly_profit    = monthly_sales − monthly_purchases − monthly_expenses
gross_profit      = sales − FIFO_cost_of_goods_sold
net_profit        = gross_profit − expenses − discounts/adjustments
```
