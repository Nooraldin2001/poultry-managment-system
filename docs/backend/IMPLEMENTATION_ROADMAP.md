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

## Phase 3 — Inventory foundation, FIFO layers, stock movements  ✅ DONE

- **Goals:** inventory ledger + FIFO primitives + manual adjustments + stocktaking,
  independent of sales/purchases.
- **Models (implemented):** `InventoryBalance`, `FIFOStockLayer`, `StockMovement`
  (append-only), `StockAdjustment`, `StocktakingSession`, `StocktakingLine`,
  `InventoryValuationSnapshot` (lightweight, optional).
- **APIs (implemented):** `/api/v1/tenant/inventory/` (+ `summary`, `low-stock`,
  `valuation`, `movements`, `opening-stock`, `products/{id}` + `/movements`,
  `adjustments`, `stocktaking` + lines + apply). See
  `PHASE_3_INVENTORY_IMPLEMENTATION_NOTES.md`.
- **Services:** `add_stock`, `consume_stock_fifo` (oldest-first, locked),
  `correct_stock`, `apply_stock_adjustment`, stocktaking create/line/apply,
  `estimate_fifo_value`, `get_inventory_summary` — all in
  `apps/inventory/services.py`, used by views and (later) purchases/sales.
- **Tests:** 37 added (163 total passing) — no negative stock, FIFO consumption
  + cost, integrity guard when layers can't cover balance, adjustments +
  stocktaking create movements + audit, role defaults, valuation gating.
- **Outcome:** stock can be seeded (`seed_inventory_demo`) / adjusted; FIFO
  engine proven by tests — the engine sales/purchases will reuse.
- **Next:** Phase 4 (Purchases) calls `add_stock(source_type=purchase_invoice)`.

## Phase 4 — Purchases + purchase approval  ✅ DONE

- **Goals:** purchase draft → approve adds stock/layers + supplier payable; adjustments;
  attachment upload; cancel rules; production data hygiene pass.
- **Models (implemented):** `PurchaseInvoice`, `PurchaseInvoiceLine`,
  `PurchaseAdjustment`, `PurchaseAttachment`, `PurchaseStatusHistory` (+ uses Phase 3
  inventory `add_stock`/`reverse_source_layers` + Phase 2 suppliers/products + the
  `company_settings` numbering service).
- **APIs (implemented):** `/api/v1/tenant/purchases/` (+ `summary`, `approve`,
  `cancel`, nested `lines`, `adjustments`, `attachments`) and
  `/api/v1/tenant/suppliers/{id}/purchases/`. See
  `PHASE_4_PURCHASES_IMPLEMENTATION_NOTES.md`.
- **Services:** `create_purchase_invoice`, `recalculate_purchase_invoice`,
  `approve_purchase_invoice`, `cancel_purchase_invoice`, `create_purchase_attachment`,
  `get_purchase_summary`, `get_supplier_purchase_history` — all in
  `apps/purchases/services.py`. Supplier ledger via `suppliers.services`
  (`record_purchase_invoice` / `reverse_purchase_invoice`).
- **Tests:** 31 added (158 total passing) — draft has no side effects; approval creates
  layers/movement/ledger + updates supplier balance + audited; cancel reverses or blocks
  when stock consumed; adjustment-effect routing (payable vs inventory cost); permission
  + tenant isolation; production data-hygiene checks.
- **Data hygiene:** demo seed commands are opt-in (`--confirm-demo-data`); deploy
  scripts never seed demo data; frontend `useMock` defaults to false in production.
- **Acceptance:** approving a purchase increases stock + supplier balance atomically.

## Phase 5 — Sales + sales approval  — ✅ IMPLEMENTED

- **App:** `apps.sales` — models, calculations, services, serializers, viewset, admin.
- **Goals met:** draft → approve deducts FIFO + COGS + customer receivable; credit limit +
  override; special prices + free products; cancel reversal; collection adjustment
  foundation; print-preview JSON API.
- **APIs:** `/api/v1/tenant/sales/` (+ approve, cancel, collection-adjustment,
  print-preview, summary, price-preview, stock-check, lines, adjustments);
  `/api/v1/tenant/customers/{id}/sales/`.
- **Inventory:** `consume_stock_fifo_detailed` extended; `SalesInventoryAllocation` for
  layer trace + cancellation return.
- **Tests:** 33 added (197 total passing) — draft no side effects; approval FIFO/ledger/
  profit/audit; credit limit + override; cancel reversal; collection adjustment;
  permissions + tenant isolation.
- **Data hygiene:** no sales demo seed in deploy; `purge_demo_data` includes sales models.
- **Acceptance:** end-to-end sale approve/cancel keeps inventory + customer balance +
  audit consistent.
- **Next:** Phase 6 (Payments and receipts).

## Phase 6 — Payments and receipts  — ✅ IMPLEMENTED

- **App:** `apps.payments` — `PaymentMovement`, `PaymentAllocation`, `PaymentStatusHistory`.
- **Goals met:** customer collections, supplier payments, refunds, invoice allocations,
  receipt numbering, cancellation/reversal, print-preview JSON, reconciliation.
- **APIs:** `/api/v1/tenant/payments/...`, `/api/v1/tenant/receipts/...`.
- **Tests:** 22 added (219 total passing).
- **Acceptance:** collections/payments update ledger + invoice payment state; cancellation
  reverses safely; receipts printable via JSON preview.
- **Next:** Phase 7 (Quotations).

## Phase 7 — Quotations  — ✅ IMPLEMENTED

- **App:** `apps.quotations` — `Quotation`, `QuotationLine`, `QuotationStatusHistory`.
- **Goals met:** lifecycle (draft/sent/accepted/rejected/cancelled/expired/converted),
  special/free pricing, conversion to sales draft, print-preview JSON, stock warnings.
- **APIs:** `/api/v1/tenant/quotations/...`, `/customers/{id}/quotations/`.
- **Tests:** 27 added (246 total passing).
- **No side effects:** no inventory, ledger, or payments at any quotation status.
- **Acceptance:** convert → sales draft → approval path works without double stock deduction.
- **Next:** Phase 8 (Expenses).

## Phase 8 — Expenses

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
