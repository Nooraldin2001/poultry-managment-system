# Launch Decision

- **Date (UTC):** 2026-07-04 (updated)
- **Production URLs:** `poultryhero.solutions`, `admin.poultryhero.solutions`, `{subdomain}.poultryhero.solutions`

---

## Final status

# **GO WITH CONDITIONS**

Company creation and Super Admin flows are fixed and deployed. **Tenant subdomain routing is blocked by Nginx/SSL infrastructure** — not application code.

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
| Tenant customer create (live API) | Fixed (pending deploy) |

---

## Customer creation blocker (fixed in code)

**Symptom:** Add Customer showed success but no row appeared — no network POST.

**Cause:** `CreateCustomerScreen` never called `POST /api/v1/tenant/customers/`.

**Fix:** Frontend wired to live API with validation errors and list refetch on success. Deploy required before production verification.

---

## Next steps (VPS — required)

```bash
cd /var/www/poultryhero
git pull origin main
bash scripts/fix_tenant_subdomain_routing.sh
```

Then manual smoke: open `https://firstview.poultryhero.solutions` → Poultry Hero login → tenant user login.
