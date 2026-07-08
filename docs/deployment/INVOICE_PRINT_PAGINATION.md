# Invoice Print Pagination

## Fixes applied

- A4 print settings updated (`@page size A4 portrait; margin 8mm`)
- Invoice container uses `.invoice-page` with print-safe layout
- Table pagination rules:
  - `thead { display: table-header-group; }`
  - `tfoot { display: table-footer-group; }`
  - rows avoid mid-row splitting (`break-inside/page-break-inside: avoid`)
- Totals/footer protected from split:
  - `.invoice-totals`
  - `.invoice-footer`
- `.no-print` utility hides non-print actions

## Cartons column fix

Print line table now includes:
- Item / ?????
- Cartons / ?????
- Pieces / ???
- KG / ????
- Unit / ??????
- Price / ?????
- Total / ????????

Backend print payload now includes both compatibility and explicit keys:
- `quantity_cartons`, `quantity_pieces`, `quantity_kg`
- `cartons`, `pieces`, `kg`

Front-end mapping reads these keys and renders cartons/pieces/kg correctly for sales and purchase previews.

