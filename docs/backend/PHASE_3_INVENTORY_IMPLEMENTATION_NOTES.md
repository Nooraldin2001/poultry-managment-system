# Phase 3 Implementation Notes — Inventory Foundation (FIFO)

This phase delivers the **inventory engine** that later purchase approval and
sales approval will call. It implements balances, an append-only stock-movement
history, hidden FIFO cost layers, opening stock, manual stock adjustments,
stocktaking, and FIFO valuation summaries — with permissions and audit logging.

**Not implemented here:** purchase invoices, sales invoices, quotations,
payments, expenses, VAT/reports, frontend integration. Those are later phases
that *consume* this engine.

Built consistently with Phase 0–2: `TenantOwnedModel` base, DRF
serializers/views/services, `/api/v1/tenant/` URLs, permission catalog +
per-user overrides, and the append-only audit foundation. All stock-mutating
logic lives in `apps/inventory/services.py`, never in views.

---

## App created

| App | Purpose |
| --- | --- |
| `apps.inventory` | Balances, FIFO layers, movements, adjustments, stocktaking, valuation |

Registered in `INSTALLED_APPS` and mounted at `/api/v1/tenant/` via
`apps.inventory.urls`.

---

## Models created

All inherit `TenantOwnedModel` (company FK + timestamps). Quantities use
`cartons (14,2)`, `pieces (14,2)`, `kg (14,3)`; cost `unit_cost_per_kg (12,4)`;
money `(16,2)`.

- **InventoryBalance** — current total stock per product (the UI source of
  truth). `unique(company, product)`; indexes `(company, product)`,
  `(company, available_kg)`; DB **check constraint** keeps available quantities
  ≥ 0. Created lazily on first movement/adjustment. Computed `stock_status`
  (`available` / `low` / `out_of_stock` / `needs_review`) from the product's
  minimum-stock levels. Reserved columns exist (default 0) for future use.
- **FIFOStockLayer** — hidden cost layer for valuation/profit. Tracks
  `original_*` + `remaining_*` quantities, `unit_cost_per_kg`, `total_cost`,
  `is_depleted`, `received_at`, and `source_type`/`source_id`. Indexes
  `(company, product, is_depleted, received_at)` and
  `(company, source_type, source_id)`. Check constraint: remaining/cost ≥ 0.
- **StockMovement** — append-only history (overrides `save`/`delete`). Stores
  `movement_type`, `direction` (in/out/neutral), signed deltas,
  `balance_*_after`, `fifo_cost_consumed`, `unit_cost_per_kg`, `reason`,
  `created_by`. Indexes `(company, product, created_at)`,
  `(company, movement_type)`, `(company, reference_type, reference_id)`.
  Check constraint: balance-after ≥ 0. **No update/delete API** — corrections
  append new movements.
- **StockAdjustment** — user-requested manual adjustment record
  (`increase`/`decrease`/`correction`), snapshots current/adjustment/new
  quantities, `reason` (required), optional `attachment`, `applied_by`,
  `related_movement`, `status` (`applied`/`reversed` placeholder).
- **StocktakingSession** — count event; `unique(company, session_number)`;
  `status` (`draft`/`applied`/`cancelled`), `count_date`, `started_by`,
  `applied_by/at`.
- **StocktakingLine** — per-product comparison; `unique(session, product)`;
  auto-computed `difference_*` + `status` (`matched`/`increase`/`decrease`/
  `needs_review`); optional `related_movement` after apply.
- **InventoryValuationSnapshot** — lightweight optional snapshot
  (`snapshot_date`, `total_inventory_value`, `total_available_kg`). Created as a
  model for future report materialization; **no automatic generation** in this
  phase.

---

## Services created (`apps/inventory/services.py`)

All mutations run in `transaction.atomic` and lock the `InventoryBalance` row
with `select_for_update`. FIFO layers are also locked during consumption.

- `get_or_create_balance(company, product)` — validates same-company +
  `track_inventory`, returns/creates the balance.
- `add_stock(...)` — increases balance, creates a FIFO layer + inbound
  movement; audits when the source is sensitive (manual/opening/adjustment).
  `total_cost = kg × unit_cost_per_kg`.
- `consume_stock_fifo(...)` — checks availability, consumes oldest layers first
  (`received_at`, `created_at`), computes `fifo_cost_consumed`, creates an
  outbound movement. **Never** allows negative balance/layers. Raises
  `InventoryIntegrityError` if the balance claims KG the layers cannot cover
  (protects profit math).
- `correct_stock(...)` — sets the balance to a new physical count by appending
  movements only (increase → `add_stock`, decrease → `consume_stock_fifo`,
  handles mixed dimensions); audits `inventory_correction`. Reason required.
- `apply_stock_adjustment(...)` — creates + applies a `StockAdjustment`
  (`increase`/`decrease`/`correction`), wiring the related movement. Reason
  required.
- `create_stocktaking_session(...)` / `add_stocktaking_line(...)` /
  `update_stocktaking_line(...)` — draft session + line management (lines
  snapshot the live system quantities and auto-compute differences).
- `apply_stocktaking_session(...)` — applies only the differences as
  movements, updates balances + `last_stocktaking_at`, marks the session
  applied (cannot apply twice), audits `stocktaking_apply`. Reason required.
- `estimate_fifo_value(company, product=None)` — Σ(`remaining_kg × unit_cost_per_kg`)
  over non-depleted layers.
- `get_inventory_summary(company)` — totals + active/low/out-of-stock counts +
  estimated FIFO value + last movement timestamp.
- `get_product_movement_history(company, product)` — movements newest-first.

---

## Endpoints created (all under `/api/v1/tenant/`)

| Method | Path | Permission |
| --- | --- | --- |
| GET | `inventory/` | `inventory.view` |
| GET | `inventory/summary/` | `inventory.view` |
| GET | `inventory/low-stock/` | `inventory.view` |
| GET | `inventory/products/{product_id}/` | `inventory.view` |
| GET | `inventory/products/{product_id}/movements/` | `inventory.view_movements` |
| GET | `inventory/movements/` | `inventory.view_movements` |
| GET | `inventory/valuation/` | `inventory.view_valuation` |
| POST | `inventory/opening-stock/` | `inventory.adjust` |
| GET/POST | `inventory/adjustments/` | view / `inventory.adjust` |
| GET | `inventory/adjustments/{id}/` | `inventory.view` |
| GET/POST | `inventory/stocktaking/` | view / `inventory.stocktaking.create` |
| GET | `inventory/stocktaking/{id}/` | `inventory.view` |
| GET/POST | `inventory/stocktaking/{id}/lines/` | `inventory.stocktaking.create` |
| PATCH | `inventory/stocktaking/{id}/lines/{line_id}/` | `inventory.stocktaking.create` |
| POST | `inventory/stocktaking/{id}/apply/` | `inventory.stocktaking.apply` |

List endpoint filters: `product`, `category`, `status`, `low_stock`,
`out_of_stock`, `search`. Movement filters: `product`, `movement_type`,
`date_from`, `date_to`, `reference_type`, `user`. The per-row
`estimated_fifo_value` is only populated when the requester has
`inventory.view_valuation`. All querysets are company-scoped (cross-tenant →
404).

---

## Permissions added

Added to `apps/permissions/catalog.py` (re-run `seed_permissions`):

- **inventory** group actions: `view` (existing), `view_movements`,
  `view_valuation`, `adjust`, `export` (plus legacy `manage`/`sensitive`).
- Multi-segment codes: `inventory.stocktaking.create`,
  `inventory.stocktaking.apply` (sensitive), `inventory.settings.manage`.

Role defaults:
- **Owner/Admin** — everything (short-circuited in the checker).
- **Accountant** — `inventory.view`, `view_movements`, `view_valuation`,
  `export`. **No** `adjust` and **no** `stocktaking.apply` by default
  (Owner/Admin or per-user override required).
- **Cashier/Sales** — `inventory.view` only (no valuation, adjust, stocktaking,
  or export).

---

## Sensitive actions / audit

Reason-required audited codes added to `apps/audit/constants.py`:
`opening_inventory` (medium), `inventory_correction` (high). The existing
`manual_stock_adjustment` and `stocktaking_apply` are reused. Audit rows are
written by the **services** (they have the before/after balances) with
`previous_value`/`new_value` snapshots, module `inventory`, reference type/id,
and risk level. Reason is enforced both in the serializers and in the services.

---

## Seed command

```
python manage.py seed_inventory_demo --company-subdomain <sub>
```

Initializes demo **opening stock** for the sample products created by
`seed_product_foundation` (900/1000/1100/1200 GRAM, Liver 500G, Gizzard 500G)
using `source_type=opening_inventory`. 1200 GRAM is seeded with zero stock (no
FIFO layer). Idempotent — skips products that already have an opening movement.
Creates **no** purchases or sales.

---

## Tests added (37 new; 163 total, all passing)

`tests/test_inventory.py`:
- **Services:** add_stock creates balance/layer/movement; increases existing
  balance; FIFO consumes oldest-first; cost-consumed across layers; insufficient
  stock blocked; FIFO-doesn't-cover-balance blocked; negative qty / negative
  cost rejected; manual increase/decrease create adjustment+movement+audit;
  correction increase & decrease.
- **Balances:** unique per company/product; cross-tenant product blocked; low &
  out-of-stock status computed.
- **Stocktaking:** create/count; difference computed; apply creates movements;
  applying twice blocked; decrease cannot go negative; reason required for
  apply; apply audited.
- **APIs:** owner/accountant/cashier can view; cashier cannot view valuation;
  accountant can view valuation; cashier/accountant cannot adjust by default;
  owner opening stock + manual adjust; adjustment without reason rejected;
  cross-tenant 404; movement-history filters; audit log on API adjustment.
- **Permissions/seed:** inventory codes seeded; role defaults; demo seeder.

---

## FIFO assumptions & limitations

- **Cost is normalized per KG.** `estimate_fifo_value` and `fifo_cost_consumed`
  use `remaining_kg × unit_cost_per_kg`. For products purchased/measured by
  piece or carton where KG is not meaningful (e.g. some by-products), the KG
  dimension may be zero and FIFO cost for that product is best-effort (`0`).
  Later purchase services will convert unit costs into an estimated cost-per-KG
  when KG is available.
- Cartons/pieces are consumed through the same FIFO layers oldest-first but do
  **not** drive costing; KG drives cost.
- A layer is marked `is_depleted` when all of remaining cartons/pieces/kg ≤ 0.
- Negative stock is impossible: availability is checked under a row lock, DB
  check constraints back it up, and FIFO coverage is verified before consuming.
- `InventoryValuationSnapshot` is defined but not auto-generated; real-time
  valuation comes from `estimate_fifo_value`. Snapshot materialization is a
  future (reports) concern.
- Stocktaking-increase cost defaults to the product's most recent layer cost
  when a line doesn't specify `unit_cost_per_kg`.
- `StockAdjustment.status=reversed` is a placeholder; reversal flows are future.

---

## Recommended next phase

**Phase 4 — Purchase Invoices**: draft → approve adds FIFO cost layers via
`add_stock(source_type=purchase_invoice)` and updates supplier payable;
purchase adjustments; supplier invoice uploads; cancel guards.
