# Release Blocker Matrix

- **Date (UTC):** 2026-07-04
- **Commit:** pending deploy (tenant subdomain fix)
- **Environment:** Production (post-fix verification pending)

| Area | Status | Blocker? | Notes | Required Action |
| --- | --- | ---: | --- | --- |
| URL Health | Pass | No | Apex + admin health OK | Verify tenant subdomain health after DNS/SSL |
| Tenant subdomain DNS/SSL | Unknown | **Yes (infra)** | Wildcard DNS + cert required | See TENANT_SUBDOMAIN_SETUP.md |
| Create company (API) | Fixed in code | No* | Wizard calls live API | Deploy + retest on VPS |
| Plans reference data | Fixed* | No* | `seed_plans` in deploy script | Run deploy / manual seed if needed |
| Tenant URL display | Fixed in code | No | `getTenantUrl()` | Deploy frontend |
| API base on tenant host | Fixed in code | No | Same-origin `/api` | Deploy frontend |
| Admin vs tenant login | Fixed in code | No | Backend + frontend guards | Deploy backend + frontend |
| Company detail (live) | Fixed in code | No | Uses `getCompanyById` | Deploy frontend |
| Tenant ERP smoke | Blocked | **Yes** | Pending deploy + infra + manual test | Full smoke after deploy |
| Tenant customer create | Fixed in code | **Yes*** | UI was toast-only (no API) | Deploy frontend + smoke POST |
| Mock Safety | Pass | No | Script passes | Re-run after deploy |

\* Pending production deploy verification.

## Counts

| Category | Count |
|---|---:|
| **Infrastructure blockers** | **1** (wildcard DNS/SSL) |
| **Pending deploy verification** | **6** |
| **Resolved in code** | **6** |

See [TENANT_SUBDOMAIN_SETUP.md](./TENANT_SUBDOMAIN_SETUP.md) and [LAUNCH_DECISION.md](./LAUNCH_DECISION.md).
