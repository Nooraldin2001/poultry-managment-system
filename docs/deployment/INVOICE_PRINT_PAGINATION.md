# Invoice Print Pagination & Mobile A4 Layout

## Root cause (mobile print — 2026-07-08)

Invoices printed from iPhone Safari / mobile Chrome appeared **too small** with **large blank areas** and **unnecessary second pages** because:

1. **Legacy print CSS** used `body * { visibility: hidden }` plus `position: absolute; width: 100%` on `.print-preview-doc`. On mobile, `100%` meant **viewport width (~390px)**, not A4 (210mm).
2. **App shell** (`h-screen`, sidebar, bottom nav, green FAB) remained in the DOM; hidden elements still affected layout height and caused blank trailing pages.
3. **Responsive wrappers** (`max-w-3xl`, `min-w-[480px]` tables) constrained the printable area on narrow screens.

## Fix — dedicated A4 print shell

New components and CSS:

| File | Role |
|------|------|
| `frontend/src/features/print/PrintA4Shell.tsx` | Wraps invoice in `.print-shell` > `.invoice-a4-page` |
| `frontend/src/features/print/print-a4.css` | mm-based A4 rules for screen preview + `@media print` |
| `frontend/src/features/print/PrintActionButtons.tsx` | Back + **طباعة / حفظ PDF** (`.print-actions.no-print`) |
| `frontend/src/features/print/triggerPrint.ts` | Double `requestAnimationFrame` before `window.print()` (mobile Safari) |

### Screen preview (mobile + desktop)

- Invoice page is always **210mm wide** (true A4).
- `.print-shell` allows **horizontal scroll** on narrow viewports instead of shrinking content.
- Gray background padding simulates paper on screen only.

### Print / Save PDF

```css
@page { size: A4 portrait; margin: 8mm; }
.invoice-a4-page { width: 194mm; /* content area inside page margins */ }
```

Hidden in print mode:

- `.tenant-app-shell` chrome (sidebar, top bar, bottom nav, FAB)
- `.print-actions`, `.no-print`

App shell classes added in `App.tsx`: `tenant-app-shell`, `tenant-sidebar`, `tenant-topbar`, `tenant-main`, `tenant-bottom-nav`, `tenant-mobile-fab`.

## Multi-page rules

Long invoices continue across pages; short invoices stay on one page.

```css
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
.invoice-header, .invoice-totals, .invoice-footer, .signature-section {
  page-break-inside: avoid;
}
```

## Table column contract (unchanged)

| Column | Arabic | Value |
|--------|--------|-------|
| Qty | الكمية | **Cartons** |
| Unit | الوحدة | **KG** |
| Price | السعر | unit price |
| Total | الإجمالي | line total |

Cuts/byproducts: cartons may be `—` or `0`; KG appears in Unit column.

Backend payload keys: `cartons`, `kg`, `quantity_cartons`, `quantity_kg`.

## Print route

Print preview remains on existing tenant screens (no separate URL required):

- Sales: `sales-preview` → `LivePrintPreviewScreen`
- Purchase: `purchases-preview` → `LivePrintPreviewScreen`

Both render **only** the A4 document inside `PrintA4Shell`; app chrome is CSS-hidden at print time.

## Manual verification checklist

| # | Check | Desktop | Mobile (390px / iPhone) |
|---|-------|---------|-------------------------|
| 1 | Invoice fills A4 width (not tiny) | ☐ | ☐ |
| 2 | No huge blank area below invoice | ☐ | ☐ |
| 3 | Short invoice = 1 page | ☐ | ☐ |
| 4 | Long invoice spans pages cleanly | ☐ | ☐ |
| 5 | Sidebar / header / bottom nav / FAB absent from PDF | ☐ | ☐ |
| 6 | Logo, TRN, stamp, signature visible | ☐ | ☐ |
| 7 | Qty = cartons, Unit = KG | ☐ | ☐ |

## Automated checks

```bash
cd frontend
corepack pnpm run typecheck
corepack pnpm run build
```

Backend print payload tests (if changed): `pytest tests/test_invoice_branding.py tests/test_sales.py tests/test_purchases.py`
