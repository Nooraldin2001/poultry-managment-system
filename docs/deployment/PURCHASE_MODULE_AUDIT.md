# Purchase Module Audit — First View Tenant

Last updated: **2026-07-05**

Tenant: `firstview` — `https://firstview.poultryhero.solutions`

---

## Issues reported

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

