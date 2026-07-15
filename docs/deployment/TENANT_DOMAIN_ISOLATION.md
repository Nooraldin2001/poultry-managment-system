# Tenant Domain Isolation

## Host Context

The frontend resolves hostname once through `hostContext` and all auth flows use
that result:

- `poultryhero.solutions`, `www.poultryhero.solutions`, and
  `admin.poultryhero.solutions` are Super Admin hosts.
- `<subdomain>.poultryhero.solutions` is a tenant host unless the subdomain is
  reserved.
- Reserved subdomains are `www`, `admin`, `api`, `static`, and `media`.
- `localhost`, `127.0.0.1`, and `<tenant>.localhost` remain supported for local
  development.

## Token Namespaces

JWTs are stored per host context rather than in shared generic keys:

```text
poultry_hero_access_token:super_admin
poultry_hero_refresh_token:super_admin
poultry_hero_access_token:tenant:<subdomain>
poultry_hero_refresh_token:tenant:<subdomain>
```

The old generic keys are read only as a migration fallback. They are migrated
only after `/auth/me/` confirms the token user is valid for the current host.
If the token belongs to a tenant while the browser is on the root/admin host, the
generic keys are removed and the Super Admin sign-in remains visible.

## Frontend Rules

- Root/admin hosts accept only Super Admin users with no company.
- Tenant hosts accept only tenant users whose `company.subdomain` matches the
  hostname.
- Super Admin users are not silently admitted into tenant portals.
- Tenant users are not redirected from the root domain to their tenant portal.
- The app renders a neutral loader while session validation is pending and does
  not render tenant dashboards from stale state.
- Logout clears only the active host namespace plus incompatible legacy keys when
  a mismatch is detected.

## Backend Rules

Backend host checks are enforced independently of the frontend:

- `/api/v1/auth/login/`
- `/api/v1/auth/refresh/`
- `/api/v1/auth/me/`
- `/api/v1/auth/logout/`
- `IsSuperAdmin`, `IsTenantUser`, `IsOwnerAdmin`, and `HasTenantPermission`

This prevents a valid JWT from being used on the wrong production domain.

## API Base

Production builds should use same-origin API calls:

```text
VITE_API_BASE=/api
VITE_USE_MOCK_DATA=false
```

`scripts/deploy_vps.sh` now fails production deployment if `VITE_API_BASE`
points to a tenant-specific host such as
`https://firstview.poultryhero.solutions/api`.
