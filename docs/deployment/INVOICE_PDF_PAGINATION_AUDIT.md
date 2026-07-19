# Invoice PDF Pagination Audit

## Reference

Production reference: `التلال 17-7-2026.pdf`, invoice `INV-00117`.

- 19 item rows
- 80 cartons
- 1,044.5 kg
- AED 11,722.00 subtotal
- AED 586.09 VAT
- AED 12,308.09 total and balance

Before the fix, the line table ended on page 1 while totals and signatures were
placed on a mostly empty page 2.

## Renderer and root cause

The frontend opens the browser print dialog through `window.print()`. The PDF is
Chrome/Edge/Safari's print output, not a Django template or JavaScript PDF
library.

There was no explicit `page-break-before`. The unnecessary second page resulted
from combined print geometry:

- 8 mm margins on all sides;
- a body fixed at 210 mm inside a 194 mm printable document;
- screen-oriented header/card/table spacing;
- a tall totals section followed by a separately protected signature section;
- totals and signatures each used `break-inside: avoid`, but were not one unit.

The browser could not fit the tall totals block in the remaining space and moved
it to page 2.

## Changes

- A4 margins changed to `6mm 7mm 7mm`.
- Printable document width changed to 196 mm.
- Removed fixed 210 mm body width in print mode.
- Added compact, readable print-only header, party card, table, totals, and
  signature spacing.
- Added controlled table column widths and wrapping table headers.
- Moved the line-total row from `tbody` to non-repeating `tfoot`.
- Added shared `.invoice-final-summary` around totals, payment details, notes,
  divider, and signatures.
- Added inline, wrapping supplier/customer heading.
- Removed the currency prefix from non-monetary payment method/account values.
- Added a direct `html2pdf.js` download action that uses the same compact A4
  layout and invoice-number filename without opening browser print settings.

## Local page-fit verification

A temporary React harness rendered the exact reference dimensions through the
real First View template and production print CSS. The harness was removed after
measurement.

- Printable A4 height: 1,073.39 CSS px
- Reference invoice content height: 960.39 CSS px
- Reserve: approximately 113 CSS px
- Estimated page count: 1
- Final summary height: 228.95 CSS px
- Table header overflow: none
- Payment method value: `Credit`
- Direct generated PDF page count: 1

A 64-line stress case measured two pages. Computed print rules confirmed:

- table header: `table-header-group`
- rows: `break-inside: avoid`
- final summary: `break-inside: avoid`

## Renderer limitations

Chromium layout was measured locally, but native Save-to-PDF output could not be
exported through the available embedded browser protocol. Physical iPhone
Safari, Android Chrome, and production tenant verification remain deployment
smoke steps.
