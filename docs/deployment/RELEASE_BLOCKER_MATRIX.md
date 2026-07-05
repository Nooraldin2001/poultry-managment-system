# Release Blocker Matrix

- **Date (UTC):** 2026-07-05
- **Commit (production bundle):** `index-DLgOG8Hc.js` on First View (includes `c7d747a` fixes)
- **Commit (local uncommitted):** SupplierModule `ApiUnavailableState` import + `invoiceApi` reason field fix
- **Environment:** Production

| Area | Status | Blocker? | Notes | Required Action |
| --- | --- | ---: | --- | --- |
| URL Health | Pass | No | First View `{"status":"ok","service":"poultryhero-api"}` | — |
| Tenant subdomain | Pass | No | Poultry Hero loads on `firstview` | — |
| Tenant login API | Pass | No | JSON 401 for bad creds | — |
| Customer create (code) | **Fixed** | No | `ded78f1` + later commits | — |
| Customer create (verified) | **Pending** | **Yes** | No owner login in agent session | Manual POST 201 smoke |
| Product create (code) | **Fixed** | No | `c7d747a` — live POST, category/SKU validation | Deploy + smoke |
| Supplier create (code) | **Fixed** | No | `c7d747a` | Deploy + smoke |
| Sales invoice create (code) | **Fixed** | No | Live screen + Save draft + approve `{reason}` | Deploy + smoke |
| Purchase invoice create (code) | **Fixed** | No | Same pattern as sales | Deploy + smoke |
| Reports demo data (code) | **Fixed** | No | `bff86fe` — `liveOrMockRows` guards | Verify empty states on First View |
| Reports demo data (DB) | Unknown | Maybe | WESTLAND strings still in bundle (dead code); may be DB seed | Run purge dry-run on VPS |
| DB demo purge dry-run | Not run | No | Agent SSH unavailable | Owner runs on VPS |
| Mock Safety | Pass (last deploy) | No | Re-run after next deploy | — |

## Counts

| Category | Count |
|---|---:|
| **Code blockers** | **0** |
| **Pending manual verification** | **5** (customer, product, sales, purchase, reports) |
| **Pending deploy** | **1** (minor: ApiUnavailableState + invoiceApi — uncommitted) |

See [TENANT_CREATE_WORKFLOW_AUDIT.md](../frontend/TENANT_CREATE_WORKFLOW_AUDIT.md).
