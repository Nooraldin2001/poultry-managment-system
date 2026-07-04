# Launch Decision

- **Date (UTC):** 2026-07-04
- **Commit / Version:** pending deploy (tenant subdomain fix branch)
- **Production URLs:**
  - `https://poultryhero.solutions`
  - `https://admin.poultryhero.solutions`
  - `https://{subdomain}.poultryhero.solutions` (tenant workspaces)
- **Tester:** Release owner + Cursor Agent

---

## Final status

# **GO WITH CONDITIONS**

Application code fixes for tenant subdomain routing, API base resolution, company creation, and admin/tenant login guards are implemented locally. Production launch depends on **deploying this commit**, updating VPS **DNS wildcard**, **Nginx wildcard `server_name`**, **wildcard SSL**, and **backend `.env` ALLOWED_HOSTS / CORS regex**.

---

## Root cause (production bugs)

1. **Create-company wizard** previously showed fake success without API calls (fixed: `createCompany` + `createCompanyAdminUser`).
2. **Frontend API base** always used `https://poultryhero.solutions/api`, so tenant subdomains never sent the correct `Host` header for login validation (fixed: `resolveApiBase()` same-origin on tenant/admin hosts).
3. **Backend login** did not enforce admin vs tenant host rules — tenant users could sign in on `admin.poultryhero.solutions` (fixed: `LoginSerializer` host checks).
4. **Tenant URLs** displayed as `*.poultryhero.com` in several screens (fixed: central `getTenantUrl()` helper).
5. **Company detail** used mock data only — list showed companies but detail/open workspace failed (fixed: live `getCompanyById`).
6. **Infrastructure**: Nginx/DNS/SSL did not include wildcard tenant subdomains (partially fixed in repo nginx config; **VPS + DNS + cert still required**).

---

## Code fix status

| Area | Status |
|------|--------|
| Company creation API wiring | Fixed |
| Plans load from live API in wizard | Fixed |
| Tenant URL helper (`getTenantUrl`) | Fixed |
| Host-aware API base (`resolveApiBase`) | Fixed |
| Backend host login guards | Fixed |
| Admin tenant-access-denied screen | Fixed |
| Company detail live API | Fixed |
| Nginx wildcard in repo | Fixed |
| Backend CORS regex support | Fixed |
| `seed_plans` / `seed_permissions` in deploy script | Fixed |

---

## Infrastructure status (must verify on VPS)

| Item | Status |
|------|--------|
| DNS `A * → 153.92.5.195` | **Manual verify** |
| Wildcard SSL `*.poultryhero.solutions` | **Manual verify / likely blocker** |
| Nginx `*.poultryhero.solutions` | Update live config from repo + reload |
| `DJANGO_ALLOWED_HOSTS=.poultryhero.solutions,...` | Update live `.env` |
| `CORS_ALLOWED_ORIGIN_REGEXES` | Update live `.env` |

See [TENANT_SUBDOMAIN_SETUP.md](./TENANT_SUBDOMAIN_SETUP.md).

---

## Next manual smoke (after deploy)

1. Super Admin: create company `firstview` at `admin.poultryhero.solutions`
2. Confirm tenant URL `https://firstview.poultryhero.solutions`
3. Tenant owner login on tenant URL → ERP dashboard
4. Same credentials on admin URL → access denied (not Super Admin dashboard)
5. `curl -s https://firstview.poultryhero.solutions/api/v1/health/`

---

## Previous decision (2026-07-02)

**NO-GO** at commit `dcdd536` due to fake company creation and missing plans. Addressed in code; pending production deploy + infra.
