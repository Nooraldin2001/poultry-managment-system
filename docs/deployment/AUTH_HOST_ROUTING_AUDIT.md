# Auth Host Routing Audit

## Issue

Opening `https://poultryhero.solutions/` after a prior tenant login could restore
a tenant session and render tenant mode on the root domain. The sign-in screen
appeared briefly while `AuthProvider` was checking `/api/v1/auth/me/`, then the
app accepted the returned tenant user and switched to the tenant dashboard.

## Root Cause

Frontend session restore validated that a token existed and that `/auth/me/`
returned a user, but the restored user was not validated against the current
hostname before React auth state was set. Fresh login had partial host handling,
including a root-domain tenant redirect, but restore and login did not share a
single compatibility matrix.

Backend `/api/v1/auth/me/` and permission classes also trusted the token user's
company. A valid tenant token could be used from the wrong production host and
would expose that token user's own tenant scope under that host.

## Fix Summary

- Added `frontend/src/services/hostContext.ts` as the canonical frontend host
  resolver.
- Added `isSessionCompatibleWithHost(user, hostContext)` and applied it during
  login, session restore, route selection, and logout fallback behavior.
- Namespaced frontend JWT storage by host context:
  - `poultry_hero_access_token:super_admin`
  - `poultry_hero_refresh_token:super_admin`
  - `poultry_hero_access_token:tenant:<subdomain>`
  - `poultry_hero_refresh_token:tenant:<subdomain>`
- Legacy generic tokens are only migrated after `/auth/me/` proves the session is
  compatible with the active hostname. Incompatible legacy tokens are removed
  from the active origin.
- Removed the root-domain tenant redirect path. Tenant users must sign in from
  the tenant domain; the root domain remains the Super Admin portal.
- Added backend `assert_auth_host_compatible()` in `apps.core.tenancy` and wired
  it into login, refresh, `/auth/me/`, logout, and shared permission classes.

## Compatibility Matrix

| Host | Accepted Session |
| --- | --- |
| `poultryhero.solutions` | Super Admin user with `company = null` |
| `www.poultryhero.solutions` | Super Admin user with `company = null` |
| `admin.poultryhero.solutions` | Super Admin user with `company = null` |
| `<tenant>.poultryhero.solutions` | Tenant user whose `company.subdomain` matches `<tenant>` |
| local/test hosts | Permissive for development and existing automated tests |

Mismatch responses use:

```json
{
  "detail": "This session is not valid for the current domain.",
  "code": "auth_host_mismatch"
}
```

## Nginx Finding

The checked-in `deploy/nginx/poultryhero.conf` serves
`poultryhero.solutions`, `www`, `admin`, and `*.poultryhero.solutions` from the
same frontend shell and preserves `Host` on `/api/` proxy requests. It contains
no apex-to-tenant redirect.

Live `sudo nginx -T` still needs to be run on the VPS during deployment smoke to
confirm production matches the checked-in config.

## Verification

- `python manage.py check` - pass
- `python -m pytest tests/test_auth.py tests/test_auth_host_login.py tests/test_tenant_isolation.py tests/test_companies.py tests/test_users.py` - pass
- `corepack pnpm run typecheck` - pass

Frontend has no configured unit test runner in `package.json`; host-context
coverage is currently enforced by TypeScript and backend host-matrix tests.
