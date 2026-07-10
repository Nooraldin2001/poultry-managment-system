# Purchase Module Audit — First View Tenant

Last updated: **2026-07-05**

Tenant: `firstview` — `https://firstview.poultryhero.solutions`

---

## 2026-07-10 VAT duplication fix

| Issue | Root cause | Fix |
|-------|------------|-----|
| Line total includes VAT + footer adds VAT again | Print preview used `line_total` in table; purchase lines sometimes had `vat_rate=0` while header VAT was 5% | Table shows `display_total` / `line_subtotal` (ex-VAT); lines inherit `invoice.vat_rate` on create; backend recalculates all totals; labels: ????? ??? ??????? / Price before VAT |

**Formulas:** `line_subtotal = kg|pieces|cartons � unit_price`; `vat = taxable � rate`; `gross = subtotal + vat`; `net = gross ? slaughter ? transport`.

**Tests:** `tests/test_invoice_line_pricing.py` (7.5 kg � 13.75 case), existing `test_purchases.py` subtotal tests.

**Print:** See `INVOICE_PRINT_TEMPLATES.md`.

---

## 2026-07-10 client blockers

| Issue | Root cause | Fix |
|-------|------------|-----|
| Line delete ? `Method "DELETE" not allowed` | `http_method_names` on `PurchaseInvoiceViewSet` excluded `delete`, so DRF returned 405 before reaching the `lines/{id}/` action | Allow `delete`; block whole-invoice `destroy()` with 405; draft-only line delete with bilingual 400 on approved invoices; clear stale prefetch cache in `recalculate_purchase_invoice`; frontend refetches detail after delete |
| Line total = pieces � price instead of kg � price | Backend already computes `kg � unit_price` for `price_type=kg`; the frontend purchase screen sent lines with a non-kg price type in some flows | Purchase lines now always use `priceType: "kg"` in `LivePurchaseInvoiceScreen` (label: `????? ??? ????` / `Price per KG`); backend never trusts frontend totals ? see `tests/test_purchases.py` KG tests |
| Backdated invoices cannot be approved | PATCH on an already-backdated draft demanded a duplicate `backdate_reason`; approve payload could not carry a reason; frontend `todayIso()` used UTC | Mixin falls back to stored reason; approve serializers accept optional `backdate_reason` validated by `ensure_backdate_reason_for_approval()`; frontend sends reason on approve and uses local date ? see `BACKDATED_INVOICES_POLICY.md` |
| Mixed cashbox/bank dropdown | Single selector listed all money accounts | Separated per payment method with balances and account-type validation at approval ? see `TREASURY_AND_BANK_ACCOUNTS.md` |

---

## Issues reported (2026-07-05)

| Issue | Root cause | Fix |
|-------|------------|-----|
| **Purchases not adding to stock / VAT required** | Line `vatRate` hardcoded 5; header VAT not PATCHed; cartons-only lines saved with `kg=0`; no inventory refetch after approve | VAT toggle + zero rates; backend quantity normalize on approve; `tenantRefresh` event |
| **Not Found on New Purchase** | Stale `selectedPurchaseId` passed to `purchases-new` → `GET /purchases/{id}/` 404 | Clear ID on new navigation; split `purchases-edit` for draft edit; `NotFoundState` for missing invoices |
| PDF/download opens raw 404 | (1) Print button navigated to preview **without** `selectedPurchaseId` → fell back to mock `PurchPreviewScreen`; (2) Backend had **no** `GET .../print-preview/` for purchases | Set purchase id before navigate; added backend endpoint; live mode never shows mock preview |
| Demo purchase visible (`WESTLAND`, `Al Wataniya`) | (1) Mock `PurchPreviewScreen` shown in live mode when id missing; (2) Possible DB-seeded demo purchases/suppliers | Route guard + `purge_tenant_demo_data --module purchases` |
| Purchase list demo rows | Live API list is correct; demo rows were mock preview fallback or DB seed | Same as above |

---

## PDF / print fix

**Preferred approach (Option 1):** Print preview screen + browser Save as PDF.

| Item | Detail |
|------|--------|
| Button label (AR) | `طباعة / حفظ PDF` |
| Button label (EN) | `Print / Save PDF` |
| Route | In-app `purchases-preview` → `LivePrintPreviewScreen` |
| API | `GET /api/v1/tenant/purchases/{id}/print-preview/` |
| Auth | Tenant JWT required; tenant-scoped |
| No real PDF endpoint | No `/pdf/` route; no WeasyPrint dependency |

### Files changed

- `backend/apps/purchases/services.py` — `build_purchase_print_preview()`
- `backend/apps/purchases/views.py` — `print_preview` action, permission `purchases.print`
- `frontend/src/features/print/LivePrintPreviewScreen.tsx` — normalize nested API shape
- `frontend/src/features/print/PrintPreviewLayout.tsx` — label update
- `frontend/src/app/PurchaseModule.tsx` — `openPrint()` sets id before navigate
- `frontend/src/app/App.tsx` — live preview requires `selectedPurchaseId`; empty state otherwise
- `frontend/src/features/invoices/LivePurchaseInvoiceScreen.tsx` — print button on detail

---

## Demo data cleanup

Command: `purge_tenant_demo_data`

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --module purchases --dry-run
python manage.py purge_tenant_demo_data --company-subdomain firstview --module purchases --confirm-delete-demo-data
```

Demo purchase indicators:

- Supplier name: `WESTLAND`, `Wataniya`, `الوطنية`, `Al Wataniya`
- Supplier invoice #: `WST-*`
- Invoice #: `PUR-2025-0042`, `PINV-DEMO`

Approved demo purchases are **cancelled first** (reverses inventory/supplier ledger when possible), then deleted.

---

## Module audit checklist

| Area | Live API | Status |
|------|----------|--------|
| Purchase list | `GET /api/v1/tenant/purchases/` | OK — no mock fallback in prod |
| New draft | `POST /api/v1/tenant/purchases/` via `LivePurchaseInvoiceScreen` | OK |
| Save draft | Header POST/PATCH | OK |
| Line add/edit/delete | `POST/PATCH/DELETE .../lines/` | OK |
| Approve | `POST .../approve/` body `{ "reason" }` | OK — persists lines + normalizes KG |
| No-VAT purchase | Header/line `vat_rate: 0`; no TRN required | **Fixed** Phase 9 |
| VAT toggle UI | `بدون ضريبة` / `No VAT` | **Fixed** Phase 9 |
| Inventory UI shows zeros | Frontend mapped wrong API fields | **Fixed** Phase 10 — `available_cartons/kg` |
| Repair approved purchases | `repair_purchase_inventory_side_effects` | **Fixed** Phase 10 |
| Poultry cuts (KG purchase) | `chicken_part` type + KG-primary UI | **Fixed** Phase 11 |
| Print preview company identity | Logo/TRN/stamp/signature via `build_company_print_identity` | **Fixed** Phase 12 |

## Print preview — company identity (Phase 12)

| Item | Detail |
|------|--------|
| API | `GET /api/v1/tenant/purchases/{id}/print-preview/` |
| Company block | `name_ar`, `name_en`, `trn`, `phone`, `address`, `email`, `logo_url`, `stamp_url`, `signature_url` |
| UI | `PrintPreviewLayout` — logo 80px, stamp 160px, signature 180px; missing images hidden |

See [INVOICE_BRANDING_AND_TAX_IDENTITY.md](./INVOICE_BRANDING_AND_TAX_IDENTITY.md).

## Product type mapping (no migration)

| Business term | Backend `product_type` | Purchase UI |
|---|---|---|
| Fixed-weight carton | `fixed_weight` | Cartons + auto KG |
| Variable weight | `moving_weight` | KG required |
| Poultry cuts | `chicken_part` | KG required, cartons hidden |
| Loose by-products | `by_product` (no carton spec) | KG required |
| Cancel | `POST .../cancel/` body `{ "reason" }` | OK |
| Print/PDF | `GET .../print-preview/` + browser print | **Fixed** |
| Detail (live) | `LivePurchaseInvoiceScreen` | OK (simplified vs mock tabs) |
| Attachments | Backend exists; UI partial | Partial |
| Permissions | owner/accountant approve; cashier 403 | OK |
| Tenant isolation | Backend queryset scoped by company | OK |
| Reports | Uses live purchase report API | OK after reports fix |

---

## Supplier dropdowns on purchase invoice (2026-07-09)

| Dropdown | Source | Filter |
|----------|--------|--------|
| Main supplier | `listPurchaseSuppliers()` ? `GET /api/v1/tenant/suppliers/?is_active=true` (all pages) | Client-side exclusion of `category_code ? {slaughterhouse, transport}` only; `other`/no-category always included |
| Slaughterhouse deduction | `GET /api/v1/tenant/suppliers/?category_code=slaughterhouse&is_active=true` | Backend filter |
| Transport deduction | `GET /api/v1/tenant/suppliers/?category_code=transport&is_active=true` | Backend filter |

- Root cause of "new supplier missing from dropdown": stale supplier list state ? creating a supplier did not broadcast a refresh, and the dropdown had no manual refresh. `createSupplier`/`updateSupplier` now emit `notifyTenantDataChanged("suppliers")`; the dropdown list subscribes to that scope, and a **????? ???????? / Refresh suppliers** button + `?? ???? ?????? ??????` empty state were added.
- Existing invoices whose saved supplier is inactive or service-category still render it via a snapshot option.
- Pagination handled via `crud.listAll()` (`results` + `next`, `page_size=100`). No mock supplier fallback in live mode.

---

## Production verification (manual)

1. Open Purchases → select invoice → Print / Save PDF → no 404, real company/supplier data
2. Browser print → Save as PDF works
3. After purge dry-run/confirm → demo WESTLAND/Wataniya invoice gone from list
4. Create new purchase → approve → inventory increases, supplier balance updates

---

## Remaining gaps

- Full tabbed detail view (costing, attachments, audit) only in mock `PurchDetailScreen`
- Attachment upload/download UI needs live wiring
- Export button on list is placeholder toast

---

## 2026-07-05 — Cancelled list + price override

| Issue | Fix |
|-------|-----|
| Cancelled purchases still in default list | Backend excludes `cancelled` unless `?status=cancelled` or `?include_cancelled=1`; frontend default filter **Active (excl. cancelled)** |
| Cancel modal toast-only | `CancelPurchModal` calls `POST /tenant/purchases/{id}/cancel/` with reason |
| Admin cannot change purchase price | `LivePurchaseInvoiceScreen` + `PurchaseLinePriceCell`; permission `purchases.override_price` |
| Old supplier/product price | `GET /tenant/purchases/price-history/?supplier=&product=` + dropdown |

See [PRICING_OVERRIDE_AND_HISTORY.md](./PRICING_OVERRIDE_AND_HISTORY.md).

---

## Invoice print templates (Phase 14 — 2026-07-06)

Purchase print preview (`GET /api/v1/tenant/purchases/{id}/print-preview/`) includes `branding` block and supplier TRN with snapshot-first + live fallback. Supplier invoice number shown in party meta when present.

Frontend uses same template registry as sales (`InvoiceTemplateRenderer`).

See [INVOICE_BRANDING_AND_TEMPLATES.md](./INVOICE_BRANDING_AND_TEMPLATES.md).

---

## Treasury & payment posting (Phase 15 � 2026-07-08)

- Added real treasury accounts (`cashbox` / `bank`) and movement ledger
- Purchase approval deducts paid amount from treasury; outstanding only to supplier ledger
- Cancel purchase reverses both supplier payable and treasury outflow
- Payment section in purchase screen now includes:
  - payment method
  - money account
  - paid amount
  - remaining payable

See:
- [TREASURY_AND_BANK_ACCOUNTS.md](./TREASURY_AND_BANK_ACCOUNTS.md)
- [PURCHASE_PAYMENT_FLOW.md](./PURCHASE_PAYMENT_FLOW.md)

---

## Backdated purchase invoices (2026-07-08)

- Permission: `purchases.backdate` (owner + accountant by default)
- Past `invoice_date` requires `backdate_reason`; future dates blocked
- Approval: FIFO `received_at`, stock `movement_date`, supplier ledger `entry_date` = `invoice_date`
- Treasury payment at approval uses `movement_date = invoice_date`
- Audit action: `backdate_purchase_invoice`

See [BACKDATED_INVOICES_POLICY.md](./BACKDATED_INVOICES_POLICY.md).
