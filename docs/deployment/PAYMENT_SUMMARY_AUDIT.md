# Payment Methods Summary Audit — First View Tenant

Last updated: **2026-07-05**

---

## Issue reported

Client saw demo data in **ملخص طرق الدفع / Payment Methods Summary**:

- Fixed AED totals (`AED 8,000`, `AED 6,000`, etc.)
- Fake activity rows (`WESTLAND FOODSTUFF`, `Prime Fresh Meat LLC`, `مطعم الخليج`)

---

## Root cause

`PaymentMethodSummaryScreen` in `PaymentsModule.tsx` **always rendered hardcoded mock KPIs and `MOCK_PAY_MOVEMENTS`**, with **no `IS_MOCK_MODE` guard** and **no live API calls**.

This is unrelated to the payments backend — `GET /api/v1/tenant/payments/summary/` already returns tenant-scoped real totals.

---

## Fix

| Layer | Change |
|-------|--------|
| Frontend | Live mode loads `getPaymentsSummary()` + `listPaymentMovementRows({ status: "posted" })` |
| Frontend | Empty tenant → `EmptyState` (zeros, no fake rows) |
| Frontend | API failure → `ErrorState` |
| Frontend | Mock data only when `IS_MOCK_MODE=true` (dev) |
| `paymentService.ts` | Fixed `party_name` mapping; `getPaymentsSummary()` parses `payment_method_breakdown` correctly |

---

## Demo DB cleanup

```bash
python manage.py purge_tenant_demo_data --company-subdomain firstview --module payments --dry-run
python manage.py purge_tenant_demo_data --company-subdomain firstview --module purchases --dry-run
# after review:
python manage.py purge_tenant_demo_data --company-subdomain firstview --module payments --confirm-delete-demo-data
python manage.py purge_tenant_demo_data --company-subdomain firstview --module purchases --confirm-delete-demo-data
```

---

## Production verification

1. Open Payments → **Payment Methods Summary**
2. Confirm no `WESTLAND` / `Prime Fresh Meat` / `مطعم الخليج` unless real DB records
3. Empty tenant → zero cards + empty state
4. With real collections → totals match payment movements
