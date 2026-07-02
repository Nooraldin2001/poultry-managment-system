# Launch Decision

- **Date (UTC):** 2026-07-02 11:00 UTC
- **Commit / Version:** `dcdd536` (`main`)
- **Production URLs:**
  - `https://poultryhero.solutions`
  - `https://admin.poultryhero.solutions`
  - `https://poultryhero.solutions/api/v1/health/`
- **Tester:** Release owner + Cursor Agent

---

## Final status

# **NO-GO**

Credentialed Super Admin smoke testing found **confirmed release blockers** that prevent tenant onboarding. Infrastructure, authentication, and read-only Super Admin flows pass, but company creation does not work in production.

---

## Credentialed evidence

### Passed

| Check | Evidence |
|---|---|
| Super Admin login | Manual login; JWT tokens stored |
| Super Admin dashboard | Loads with real zero KPIs |
| Companies list | Live API returns empty list (no fake demo companies) |
| Analytics widgets | Empty/unavailable states (`لا توجد بيانات فعلية بعد`) |
| Session persistence | Admin reload retained authenticated session |
| API routing | All calls to `https://poultryhero.solutions/api` |
| Mobile (Super Admin) | Usable at 390×844 |

### Failed / blocked

| Check | Evidence |
|---|---|
| Create company (UI) | Success screen shown; `GET /admin/companies/` still `count: 0` |
| Create company (API) | `POST /admin/companies/` → 400 `Unknown or inactive plan.` |
| Plans reference data | `GET /admin/plans/` → `[]` |
| Tenant login + ERP | Blocked — no tenant company/user exists |

---

## Counts

| Metric | Value |
|---|---:|
| Confirmed release blockers | **2** |
| Downstream blocked areas | **12** |
| High-priority non-blockers | **3** |
| Low-priority polish | **3** |

---

## Confirmed release blockers

### 1. Create-company wizard is UI-only (false success)

The Super Admin wizard in `frontend/src/app/App.tsx` (`CreateCompanyWizard`) calls `toast.success()` and `setDone(true)` on submit but **never POSTs** to `/api/v1/admin/companies/`. Operators see a success message with no backend effect.

### 2. Plans not seeded on production

`GET /api/v1/admin/plans/` returns an empty list. Even direct API company creation fails until `seed_plans` (and `seed_permissions`) run on the VPS.

---

## Recommended immediate fixes (before re-test)

### On VPS (reference data — not demo data)

```bash
cd /var/www/poultryhero/backend
source /var/www/poultryhero/.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py seed_plans
python manage.py seed_permissions
```

### In codebase (minimal fix)

1. Add `createCompanyLive` / `createCompanyAdminUserLive` to `frontend/src/services/adminService.ts`
2. Wire `CreateCompanyWizard` submit to call admin API (create company → create admin user)
3. Rebuild frontend and redeploy
4. Re-run credentialed smoke: Super Admin create company → tenant login → ERP E2E

---

## Recommended post-launch fixes

- Bundle-size optimization
- Phase 4B detail-mode parity
- Add production deploy checklist step: verify `GET /admin/plans/` non-empty after deploy

---

## Decision upgrade path

| After fixes… | Decision |
|---|---|
| Company create works; tenant ERP smoke passes; no balance/permission defects | **GO** |
| Core flows pass with minor UX gaps only | **GO WITH NON-BLOCKING LIMITATIONS** |
| Any blocker remains | **NO-GO** |

---

## Recommended next Cursor prompt

> Fix production Super Admin company provisioning: seed plans on VPS, wire `CreateCompanyWizard` to `POST /api/v1/admin/companies/` and `create-admin-user`, redeploy, then rerun credentialed production smoke test.

After **GO** or **GO WITH NON-BLOCKING LIMITATIONS**:

> Prepare Post-Launch Monitoring and Maintenance Plan with uptime checks, automated backups, log review routine, error tracking, user feedback loop, performance optimization backlog, security update schedule, and Phase 5 frontend backlog.
