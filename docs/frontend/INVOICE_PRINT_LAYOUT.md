# Invoice Print Layout

Sales and purchase invoices use the shared React print components under
`frontend/src/features/print/` and the browser's native `window.print()`.
The preview now also provides a direct **Download PDF** action powered by
`html2pdf.js`; it generates an A4 file without opening the browser print dialog.

## A4 contract

- Page: A4 portrait
- Margins: 6 mm top, 7 mm left/right/bottom
- Printable width: 196 mm
- Body: 9 pt
- Table: 8.5 pt rows, 8 pt headers
- Table cell vertical padding: approximately 1.05-1.2 mm
- Signature space: 18 mm

Print dimensions are millimetre-based and independent of viewport width. Screen
navigation, action buttons, sidebars, mobile navigation, and floating buttons
are hidden by `print-a4.css`.

## Pagination

The browser is allowed to paginate the invoice naturally:

- `thead` is `table-header-group`, so headers repeat.
- Each table row uses `break-inside: avoid`.
- The invoice-line summary is a non-repeating `tfoot` row group.
- Financial totals, payment details, divider, and both signatures are wrapped in
  `.invoice-final-summary`.
- `.invoice-final-summary` uses `break-inside: avoid`; it remains after the table
  when space exists and moves intact to the next page otherwise.

Do not add fixed A4 heights, viewport-height spacers, absolute positioning, or
unconditional page breaks to invoice sections.

## Shared labels

`InvoicePartyInfo` selects supplier or customer terminology from `partyKind`.
The party label and legal name share one wrapping flex line. Long names wrap
without truncation.

Only monetary total rows receive the `AED` prefix. Payment method and payment
account values are plain labels, for example `Credit`, not `AED Credit`.

## Mobile

Mobile Safari and Android Chrome use the same 196 mm print document as desktop.
The screen viewport only affects the scrollable preview; print mode removes
screen transforms, width constraints, overflow clipping, and app navigation.

## Direct download

`downloadInvoicePdf.ts` waits for document fonts and invoice images, applies the
same fixed 196 mm compact layout, and generates A4 pages with 6/7 mm margins.
Invoice rows and the complete final summary are protected from splitting.
Downloaded files use the invoice number, for example `invoice-INV-00117.pdf`.
