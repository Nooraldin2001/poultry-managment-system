# Release Blocker Matrix

- **Date (UTC):** 2026-07-02 11:00 UTC
- **Commit:** `dcdd536`
- **Environment:** Production

| Area | Status | Blocker? | Notes | Required Action |
| --- | --- | ---: | --- | --- |
| URL Health | Pass | No | HTTP 200 on main, admin, health | None |
| Environment | Pass (notes) | No | `DJANGO_DEBUG=False`; hosts OK | Optional: add `ENVIRONMENT` / `ENABLE_DEMO_DATA` to `.env` |
| Login/Auth | Partial Pass | **Yes** | Super Admin login works; tenant login blocked (no company) | Fix provisioning, then retest tenant login |
| Super Admin | Partial Pass | **Yes** | Dashboard/companies read OK; **create company fails** (UI fake success + no plans) | Wire wizard to API; run `seed_plans` |
| Tenant Dashboard | Blocked | **Yes** | No tenant company/user | Create company + owner via fixed flow |
| Products | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Customers | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Suppliers | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Purchases | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Sales | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Inventory | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Payments | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Quotations | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Expenses | Blocked | **Yes** | No tenant session | Retest after tenant provisioned |
| Tax | Blocked | No | Not reached | Retest after tenant provisioned |
| Reports | Blocked | No | Not reached | Retest after tenant provisioned |
| Permissions | Blocked | **Yes** | No role test users | Retest after tenant provisioned |
| Print Preview | Blocked | No | No records | Retest after ERP smoke data |
| Mobile | Partial Pass | No | Super Admin mobile OK; tenant flows blocked | Retest in-app after tenant login |
| Mock Safety | Pass | No | Linux script + bundle `VITE_USE_MOCK_DATA:"false"` | None |
| Server Logs | Not captured | No | No 500 seen in browser/API probes | Capture during re-test |

## Counts

| Category | Count |
|---|---:|
| **Release blockers (confirmed)** | **2** |
| **Release blockers (downstream blocked)** | **12** |
| **High-priority non-blockers** | **3** |
| **Low-priority polish** | **3** |

### Confirmed release blockers

1. **Super Admin create-company wizard does not call backend API** — shows false success
2. **Production plans not seeded** — `GET /admin/plans/` empty; API company create returns 400

### Downstream blocked (pending fixes above)

Tenant dashboard, ERP workflows, permissions, print previews (require provisioned tenant).

### High-priority non-blockers

1. Wire `CreateCompanyWizard` + add `createCompany` / `createAdminUser` in `adminService.ts`
2. Document/run `seed_plans` + `seed_permissions` in production runbook verification step
3. Server log capture during re-test

### Low-priority polish

1. Bundle size warning
2. Super Admin analytics depth (empty states already correct)
3. Detail-mode parity (Phase 4B)

## Blocking conclusion

Credentialed smoke **confirmed two release blockers** that prevent tenant onboarding. Infrastructure and Super Admin authentication are healthy, but **launch is not safe** until company provisioning works end-to-end.
