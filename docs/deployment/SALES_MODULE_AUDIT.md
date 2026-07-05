# Sales Module Audit

- **Date (UTC):** 2026-07-05
- **Tenant reference:** Any tenant (verified on `firstview` after deploy)

## Recent fixes

### Users & Permissions (cross-cutting)

- `GET /tenant/users/` now requires `users.view` (not `users.manage`).
- Frontend `userService` aligned with `{ effective, overrides }` API contract.

### Cancelled invoices

- Default list excludes `cancelled` unless `?status=cancelled` or `?include_cancelled=1`.
- Cancel modal calls `POST /tenant/sales/{id}/cancel/` with required reason.
- Success toast: **تم إلغاء الفاتورة بنجاح** / **Invoice cancelled successfully**.

### Price override & history

- Owner/admin can edit line `unit_price` on draft sales invoices.
- `GET /tenant/sales/price-history/` returns real prior prices (invoices + customer special).
- See [PRICING_OVERRIDE_AND_HISTORY.md](./PRICING_OVERRIDE_AND_HISTORY.md).

## Status

| Area | Status |
| --- | --- |
| List filter (hide cancelled) | Fixed (backend + frontend) |
| Cancel with reason | Fixed |
| Price override | Fixed |
| Historical price dropdown | Fixed |
| Reports exclude cancelled | Already enforced in `reports/services.py` |

## Manual smoke

1. Sales list default = active (no cancelled).
2. Filter **ملغاة** shows cancelled invoices.
3. Admin edits price on draft line → approve → print matches.
4. Previous price dropdown loads after customer + product selected.
