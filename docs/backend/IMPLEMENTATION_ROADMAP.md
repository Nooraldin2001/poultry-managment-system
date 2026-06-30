# Poultry Hero — Backend Implementation Roadmap

> Phased plan to build the Django backend and then wire the existing frontend service
> boundary to it. Each phase is independently shippable and testable. Build phases in
> order; later phases depend on earlier ones (especially inventory/FIFO before sales).

**Global definition of done (every phase):** migrations apply cleanly; tenant isolation
verified; permissions enforced; sensitive actions audited; unit + API tests green;
OpenAPI schema updated.

---

## Phase 0 — Project foundation  ✅ DONE

- **Goals:** runnable Django project, PostgreSQL, env config, DRF, JWT auth, tenant
  resolution middleware.
- **Models:** none yet (settings, base abstract models `TimeStampedModel`,
  `TenantOwnedModel`, tenant context util).
- **APIs:** health check; `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- **Tests:** project boots; login issues/refreshes JWT; tenant middleware resolves
  company from subdomain + user and rejects mismatch.
- **Risks:** subdomain resolution + CORS for `*.poultryhero.solutions`; settings split
  (dev/prod).
- **Acceptance:** can authenticate; tenant context available in requests; CI runs tests.

## Phase 1 — Tenants, users, permissions, settings, audit  ✅ DONE

- **Goals:** Super Admin can create companies + first admin; role/permission engine;
  company settings; audit logging foundation.
- **Models:** `Company`, `Plan`, `CompanySubscription`, `SubscriptionPayment`, `User`,
  `PermissionCatalog`, `RolePermissionDefault`, `UserPermissionOverride`, `ModuleAccess`,
  `CompanySettings`, `NumberingSequence`, `PrintTemplate`, `AuditLog`.
- **APIs:** `/admin/companies`, `/admin/plans`, `/admin/subscriptions/.../payments`,
  `/settings/users`, `/settings/company`, `/settings/numbering`,
  `/settings/print-templates`, `/audit`.
- **Tests:** user-limit enforcement (default 3); permission resolution (module → override →
  role default); sensitive action requires reason → audit row; tenant isolation on users.
- **Risks:** permission catalog completeness; audit-in-transaction helper.
- **Acceptance:** Super Admin onboards a tenant + admin; permissions gate endpoints; every
  sensitive action writes audit with reason.

## Phase 2 — Products, customers, suppliers (master data)  ✅ DONE

- **Goals:** master data CRUD with disable-not-delete; special prices; agreements.
- **Models (implemented):** `ProductCategory`, `Product`; `CustomerCategory`,
  `Customer`, `CustomerLedgerEntry`, `CustomerSpecialPrice`,
  `CustomerFreeProductAgreement`, `CustomerCreditLimitChange`;
  `SupplierCategory`, `Supplier`, `SupplierLedgerEntry`, `SupplierSpecialPrice`,
  `SupplierAgreement`.
- **APIs (implemented):** `/api/v1/tenant/{product-categories,products,
  customer-categories,customers,supplier-categories,suppliers}/` plus nested
  actions (disable/reactivate, ledger, statement, opening-balance, credit-limit,
  special-prices, free-products, agreements). See `PHASE_2_IMPLEMENTATION_NOTES.md`.
- **Tests:** 39 added (89 total passing) — validation, ledger conventions,
  opening-balance/credit-limit reason enforcement, duplicate active special-price
  constraint, tenant isolation, role defaults.
- **Outcome:** master data manageable per tenant; opening-balance ledger
  foundation in place with documented debit/credit conventions; disable-not-delete
  pattern; product `usage` placeholder until transactions exist.
- **Next:** Phase 3 (Inventory) consumes `Product` + opening-balance foundations.

## Phase 3 — Inventory foundation, FIFO layers, stock movements

- **Goals:** inventory ledger + FIFO primitives + manual adjustments + stocktaking,
  independent of sales/purchases.
- **Models:** `InventoryBalance`, `StockLayer`, `StockMovement`, `StockAdjustment`,
  `StocktakingSession`, `StocktakingLine`.
- **APIs:** `/inventory/items`, `/inventory/movements`, `/inventory/layers`,
  `/inventory/adjustments`, `/inventory/stocktaking` (+ lines, apply).
- **Tests:** no negative stock; FIFO consumption helper consumes oldest-first across
  layers; adjustment + stocktaking create movements; concurrency lock on layers.
- **Risks:** FIFO consumption correctness + rounding; locking under concurrency.
- **Acceptance:** stock can be seeded/adjusted; `consume_fifo()` + `add_layer()` services
  proven by tests — the engine sales/purchases will reuse.

## Phase 4 — Purchases + purchase approval

- **Goals:** purchase draft → approve adds stock/layers + supplier balance; adjustments;
  attachment upload; cancel rules.
- **Models:** `PurchaseInvoice`, `PurchaseInvoiceLine`, `PurchaseAdjustment` (+ uses
  Phase 3 inventory + Phase 2 suppliers/products).
- **APIs:** `/purchases/invoices` (+ approve, cancel, adjustments, attachment).
- **Tests:** draft adds nothing; approve creates layers + updates supplier balance;
  cancel blocked if layers consumed; adjustment types apply correct effects; audited.
- **Risks:** adjustment-effect routing (payable vs inventory cost vs expense); cancel
  guard.
- **Acceptance:** approving a purchase increases stock + supplier balance atomically.

## Phase 5 — Sales + sales approval

- **Goals:** sales draft → approve deducts FIFO + sets COGS + customer balance; credit
  limit + special prices + free products; cancel reversal; collection adjustment.
- **Models:** `SalesInvoice`, `SalesInvoiceLine` (+ inventory, customers, products).
- **APIs:** `/sales/invoices` (+ approve, cancel, collection-adjustment, print).
- **Tests:** draft no side effects; approve insufficient stock → `409`; FIFO COGS across
  layers; credit-limit block + override; cancel restores stock + reverses balance; price/
  kg/qty overrides sensitive.
- **Risks:** correctness of COGS + reversal; credit-limit boundary; free-product VAT.
- **Acceptance:** end-to-end sale approve/cancel keeps inventory + customer balance + audit
  consistent.

## Phase 6 — Payments and receipts

- **Goals:** collections, supplier payments, refunds, allocations, printable receipts,
  cancellation reversal.
- **Models:** `PaymentMovement`, `PaymentAllocation`, `Receipt`.
- **APIs:** `/payments/movements`, `/payments/collections`, `/payments/supplier-payments`,
  `/payments/refunds`, `/payments/movements/{id}/cancel`, `/payments/receipts/{id}/print`.
- **Tests:** collection updates invoice paid/remaining + customer balance; on-account
  payments; cancel reverses; discounts sensitive.
- **Risks:** allocation across multiple invoices; over-allocation guards.
- **Acceptance:** payments reconcile invoice + account balances; receipts printable.

## Phase 7 — Expenses

- **Goals:** expenses + categories + recurring + purchase-linked effects.
- **Models:** `ExpenseCategory`, `Expense`, `RecurringExpense`.
- **APIs:** `/expenses` (+ cancel), `/expenses/categories`, `/expenses/recurring`.
- **Tests:** purchase-linked effects; recurring generation (task/command); cancel reverses
  + audited.
- **Risks:** recurring generation idempotency; purchase-effect coupling.
- **Acceptance:** expenses feed profit reports; recurring templates generate on cadence.

## Phase 8 — Quotations

- **Goals:** quotations (no side effects) + convert to sales draft + expiry job.
- **Models:** `Quotation`, `QuotationLine`.
- **APIs:** `/quotations` (+ status, convert).
- **Tests:** no stock/balance change; convert creates sales draft; stock re-checked at sale
  approval; expiry flips status.
- **Risks:** conversion data fidelity (special prices carried over).
- **Acceptance:** quotation → sales draft → approval works without double-counting stock.

## Phase 9 — Tax / VAT

- **Goals:** VAT settings, per-document VAT records, summaries, credit-note placeholder.
- **Models:** `VatSettings`, `VatRecord`, `TaxCreditNote` (placeholder).
- **APIs:** `/tax/summary`, `/tax/records`, `/tax/settings`, `/tax/credit-notes`.
- **Tests:** VAT computed on approval; change/disable VAT sensitive + audited; net VAT
  estimate.
- **Risks:** retroactive rate changes; TRN warnings.
- **Acceptance:** sales/purchase VAT + net VAT reported; rate changes audited.

## Phase 10 — Reports

- **Goals:** aggregated reports + dashboard summaries (+ optional snapshot materialization).
- **Models:** `ReportSnapshot` (optional).
- **APIs:** `/dashboard/summary`, `/reports/summary`, `/reports/{sales,purchases,inventory,
  profit,customers,suppliers}`, `/reports/export`.
- **Tests:** profit formulas (daily/monthly/gross/net); FIFO valuation; export sensitive +
  audited; numbers match transactional data.
- **Risks:** aggregate performance; snapshot freshness.
- **Acceptance:** dashboards + reports match underlying ledgers.

## Phase 11 — Frontend API integration

- **Goals:** replace mock services with real API calls; flip `API_CONFIG.useMock=false`.
- **Work:** implement `request()` in `src/services/api/client.ts` (fetch + JWT + base URL);
  swap each mock service in `src/services/index.ts` for a real implementation matching the
  same signatures; add auth/login flow + token storage + subdomain handling; map list
  responses to `ListResponse<T>`.
- **Tests:** contract tests per service vs OpenAPI; e2e smoke per module; build + typecheck
  stay green.
- **Risks:** shape drift between mock types and API payloads (see
  FRONTEND_BACKEND_MAPPING); money/qty wire format.
- **Acceptance:** app runs against the live backend with identical screen behavior; mock
  mode still available via `useMock`.

---

## Suggested sequencing notes

- Phases 0–1 are the hard prerequisite (auth + tenancy + audit) for everything.
- **Inventory/FIFO (Phase 3) must land before sales/purchases approval** — it is the
  engine they both call.
- Frontend integration (Phase 11) can begin incrementally per module as each backend
  module stabilizes, rather than all at once.
