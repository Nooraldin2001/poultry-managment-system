# Release Blocker Matrix

- **Date (UTC):** 2026-07-05
- **Commit (origin/main):** `88822cd` — purchase new route, product list edit, supplier PATCH
- **Commit (production bundle):** `index--O_NXaJC.js` (pre-`88822cd` — **deploy pending**)
- **Environment:** Production

| Area | Status | Blocker? | Notes | Required Action |
| --- | --- | ---: | --- | --- |
| URL Health | Pass | No | First View `{"status":"ok","service":"poultryhero-api"}` | — |
| Tenant subdomain | Pass | No | Poultry Hero loads on `firstview` | — |
| Tenant login API | Pass | No | JSON 401 for bad creds | — |
| Customer create (code) | **Fixed** | No | `ded78f1` + later commits | — |
| Product edit (code) | **Fixed** | No | Reason modal + PATCH payload mapper | Deploy + smoke |
| Expense create (code) | **Fixed** | No | Live POST + list mapper fix | Deploy + smoke |
| Expense category create (code) | **Fixed** | No | Auto `code` on POST | Deploy + smoke |
| Purchase Not Found (code) | **Fixed** | No | Stale ID on new purchase cleared | Deploy + smoke |
| Product list edit (code) | **Fixed** | No | `products-edit` route + ID | Deploy + smoke |
| Supplier edit (code) | **Fixed** | No | `suppliers-edit` + PATCH | Deploy + smoke |
| Sales white screen (code) | **Fixed** | No | `partially_paid` status crash + error boundary | Deploy + smoke |
| Sales edit Not Found (code) | **Fixed** | No | `sales-edit` route + DB id + NotFoundState | Deploy + smoke |
| Reports demo KPIs (code) | **Fixed** | No | Reports home wired to dashboard API | Deploy + smoke |
| Customer opening balance (code) | **Fixed** | No | Profile modal + opening-balance POST | Deploy + smoke |
| Customer create (verified) | **Pending** | **Yes** | No owner login in agent session | Manual POST 201 smoke |
| Product create (code) | **Fixed** | No | `c7d747a` — live POST, category/SKU validation | Deploy + smoke |
| Supplier create (code) | **Fixed** | No | `c7d747a` | Deploy + smoke |
| Sales invoice create (code) | **Fixed** | No | Live screen + Save draft + approve `{reason}` | Deploy + smoke |
| Purchase invoice create (code) | **Fixed** | No | Same pattern as sales | Deploy + smoke |
| Purchase no-VAT + inventory (code) | **Fixed** | No | VAT optional; KG normalize on approve; list refresh | Deploy + smoke |
| Inventory UI field mapping (code) | **Fixed** | No | `available_*` API fields mapped correctly | Deploy + smoke |
| Poultry cuts on purchase (code) | **Fixed** | No | `chicken_part` KG-primary lines; no cartons required | Deploy + smoke |
| Invoice branding & tax identity (code) | **Fixed** | No | Company assets + customer TRN on print preview | Deploy + smoke |
| Invoice template & color themes (code) | **Fixed** | No | `InvoiceDesignSettings` + 4 templates + 7 themes + Settings UI | Deploy + smoke |
| Super Admin company edit (code) | **Fixed** | No | `AdminCompanyEditScreen` + PATCH company profile | Deploy + smoke |
| Repair command for approved purchases | **Fixed** | No | `repair_purchase_inventory_side_effects` dry-run/confirm | Deploy + run on firstview |
| Payment Methods Summary (code) | **Fixed** | No | Live API wired; mock only in dev | Deploy + smoke |
| Auto invoice numbering (code) | **Fixed** | No | PUR-/SAL- yearly server-side generation | Deploy + smoke |
| Purchase demo data (DB) | Unknown | **Yes** | WESTLAND / Wataniya may be DB seed | VPS purge dry-run + confirm |
| Reports demo data (code) | **Fixed** | No | `bff86fe` — `liveOrMockRows` guards | Verify empty states on First View |
| Reports demo data (DB) | Unknown | Maybe | WESTLAND strings still in bundle (dead code); may be DB seed | Run purge dry-run on VPS |
| DB demo purge dry-run | Not run | No | Agent SSH unavailable | Owner runs on VPS |
| Mock Safety | Pass (last deploy) | No | Re-run after next deploy | — |

## Counts

| Category | Count |
|---|---:|
| **Code blockers** | **0** |
| **Pending manual verification** | **8** (product edit, expense, category, carton calc, opening balance, customer create, sales, purchase) |
| **Pending deploy** | **1** (`88822cd` — purchase/supplier/product edit routes) |

See [TENANT_CREATE_WORKFLOW_AUDIT.md](../frontend/TENANT_CREATE_WORKFLOW_AUDIT.md).
| Treasury & bank accounts (code) | **Fixed** | No | `MoneyAccount` + `MoneyMovement` + treasury APIs + live screen | Deploy + smoke |
| Purchase payment posting split (code) | **Fixed** | No | cash/bank deduct treasury; credit/partial post outstanding payable | Deploy + smoke |
| Invoice line delete permission UX (code) | **Fixed** | No | draft-only delete + permission-gated UI + clear AR/EN errors | Deploy + smoke |
| Invoice multipage print + cartons column (code) | **Fixed** | No | print CSS pagination + cartons/pieces/kg rendered in print table | Deploy + smoke |
| Mobile invoice A4 print layout (code) | **Fixed** | No | `PrintA4Shell` + mm-based print CSS; app chrome hidden; mobile Safari print | Deploy + mobile smoke |
