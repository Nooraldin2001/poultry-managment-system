# Release Blocker Matrix

- **Date (UTC):** 2026-07-04 (evening)
- **Commit (production):** `ded78f1` (customer create fix deployed)
- **Commit (pending):** local reports demo fix — not on `origin/main`
- **Environment:** Production

| Area | Status | Blocker? | Notes | Required Action |
| --- | --- | ---: | --- | --- |
| URL Health | Pass | No | First View health JSON OK | — |
| Tenant subdomain | Pass | No | Poultry Hero login loads on `firstview` | — |
| Tenant login API | Pass | No | JSON 401 for bad creds (not DisallowedHost) | — |
| Customer create (deploy) | **Deployed** | No* | Commit `ded78f1` on VPS | Owner manual POST 201 smoke |
| Customer create (verified) | **Pending** | **Yes** | Agent has no tenant credentials | Login + Add Customer smoke |
| Tenant reports demo data | Fixed locally | **Yes** | **Not deployed** — old bundle still has demo strings | Commit, push, deploy reports fix |
| DB demo purge dry-run | Not run | No | SSH unavailable to agent | Run on VPS after login smoke |
| Mock Safety | Pass | No | Passed on last VPS deploy | Re-run after reports deploy |

\* Pending production deploy verification.

## Counts

| Category | Count |
|---|---:|
| **Infrastructure blockers** | **0** |
| **Pending manual verification** | **2** (customer POST 201, reports empty states) |
| **Pending deploy** | **1** (reports demo fix — local only) |

See [TENANT_SUBDOMAIN_SETUP.md](./TENANT_SUBDOMAIN_SETUP.md) and [LAUNCH_DECISION.md](./LAUNCH_DECISION.md).
