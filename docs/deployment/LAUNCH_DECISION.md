# Launch Decision

- **Date (UTC):** 2026-07-04 (updated)
- **Production URLs:** `poultryhero.solutions`, `admin.poultryhero.solutions`, `{subdomain}.poultryhero.solutions`

---

## Final status

# **NO-GO**

Customer creation fix (`ded78f1`) is **deployed** to production but **not manually verified** (no owner login in agent session). Reports demo-data fix is **not deployed** (local changes only). DB audit/purge not run.

---

## Production status (2026-07-04 evening)

| Item | Status |
|------|--------|
| VPS deploy (`ded78f1`) | **Done** — bundle `index-dMIyB4tH.js`, mock safety pass |
| First View health | **Pass** — `{"status":"ok","service":"poultryhero-api"}` |
| Tenant login API | **Pass** — JSON responses (not DisallowedHost) |
| Customer create UI fix | **Deployed** — manual POST 201 smoke **pending** |
| Reports demo fix | **Not deployed** — commit + push + redeploy required |
| DB purge dry-run | **Not run** |

---

## Root cause: tenant subdomain shows BizManager Pro

| Check | Result |
|-------|--------|
| DNS `firstview.poultryhero.solutions` | Resolves to `153.92.5.195` |
| `https://admin.poultryhero.solutions` | Poultry Hero (correct) |
| `https://firstview.poultryhero.solutions` | **BizManager Pro** ("Web-Based Business Management System") |
| SSL on tenant subdomain | Browser "Not secure" — cert/SNI mismatch + wrong default SSL server |

**Cause:** Nginx `443` block for `poultryhero.conf` covers only explicit hosts (apex, www, admin, demo). Unmatched tenant hosts (`firstview.poultryhero.solutions`) hit the **default SSL server** — an old BizManager Pro site on the same VPS.

**Fix:** Run `scripts/fix_tenant_subdomain_routing.sh` on VPS + wildcard SSL cert for `*.poultryhero.solutions`.

---

## Code status (already deployed)

| Area | Status |
|------|--------|
| Company creation API | Fixed |
| Tenant URL helper | Fixed |
| API base same-origin on tenant host | Fixed |
| Backend login host guards | Fixed |
| Admin tenant-access-denied | Fixed |
| Tenant customer create (live API) | **Deployed** (`ded78f1`) — manual verification pending |

---

## Customer creation blocker (fixed in code)

**Symptom:** Add Customer showed success but no row appeared — no network POST.

**Cause:** `CreateCustomerScreen` never called `POST /api/v1/tenant/customers/`.

**Fix:** Frontend wired to live API with validation errors and list refetch on success. Deploy required before production verification.

---

## Reports demo data blocker (fixed in code)

**Symptom:** First View reports showed fake customers/suppliers/invoices (مطعم الخليج, WESTLAND, AED sample totals) after login.

**Cause:** **Frontend mock fallback** — `ReportsModule.tsx` and tenant dashboard sections rendered hardcoded `R_*` / `T_*` sample arrays regardless of `IS_MOCK_MODE=false`. Live API KPIs were fetched but charts/tables always used demo rows.

**Fix:** Reports use `liveOrMockRows` / API `records` only in live mode; empty/zero states when API returns no data. Mock samples gated behind `IS_MOCK_MODE`. Backend `purge_tenant_demo_data` command added for scoped DB cleanup (dry-run default).

**DB vs frontend:** Primary issue was **frontend**; DB purge not yet run on production.

---

## Next steps (VPS — required)

```bash
cd /var/www/poultryhero
git pull origin main
bash scripts/fix_tenant_subdomain_routing.sh
```

Then manual smoke: open `https://firstview.poultryhero.solutions` → Poultry Hero login → tenant user login.
