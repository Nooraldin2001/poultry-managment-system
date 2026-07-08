# Reports Module Audit — Demo KPI Fix

- **Date (UTC):** 2026-07-05
- **Tenant:** `firstview` — `https://firstview.poultryhero.solutions`
- **Issue:** Reports home showed hardcoded demo AED values (18,450 / 425,000 / etc.) in production

## Root cause

| Layer | Problem |
| --- | --- |
| **Frontend** | `ReportsHomeScreen` KPI cards were **always hardcoded** — never called live API, even when `IS_MOCK_MODE=false` |
| **Sub-reports** | Sales/purchase/profit/tax screens already used live API in production; customer/supplier home tables show empty state in live mode |
| **Backend** | `GET /api/v1/tenant/reports/dashboard/` returns tenant-scoped zeros for empty company (tests pass) |
| **Database** | Not verified from agent (SSH unavailable); demo DB rows may still exist — run dry-run on VPS |

## Fix

| Area | Change |
| --- | --- |
| `ReportsHomeScreen` | Fetches `getTenantDashboardSummary()` for **today** + **month**; KPIs via `formatReportAed()` |
| `reportLiveData.ts` | Added `formatReportAed()` helper |
| Mock mode | Hardcoded sample KPIs only when `IS_MOCK_MODE=true` |
| Live empty tenant | All KPI cards show **AED 0** from API |

## API

| Method | Path | Use |
| --- | --- | --- |
| GET | `/api/v1/tenant/reports/dashboard/?date_from=&date_to=` | Reports home KPIs (today + month) |
| GET | `/api/v1/tenant/reports/sales/` | Sales report screen |
| GET | `/api/v1/tenant/reports/purchases/` | Purchase report screen |
| GET | `/api/v1/tenant/reports/profit/` | Profit report screen |

Backend excludes draft/cancelled invoices from report querysets (`test_reports.py`).

## Tests / checks

- `pytest tests/test_reports.py` — **30 passed**
- `pnpm run typecheck` — **Pass**
- `pnpm run build` — **Pass**

## DB cleanup (if demo records exist)

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --dry-run
# Review output only — do not confirm-delete without owner approval
```

## Production verification

1. Login First View owner → **التقارير والتحليلات**
2. KPI cards show **AED 0** (empty tenant) or real totals from approved transactions
3. No values like AED 18,450 / 425,000 unless backed by real data
4. Open Sales/Purchase reports → empty state or live rows only

---

## Backdated invoice reporting (2026-07-08)

- Sales/purchase/profit/tax reports use **`invoice_date`**
- Inventory movement report uses **`StockMovement.movement_date`** (not `created_at`)
- Dashboard month/today KPIs use business dates

See [BACKDATED_INVOICES_POLICY.md](./BACKDATED_INVOICES_POLICY.md).
