# Tenant subdomain setup (production)

This document describes how tenant company workspaces are served at:

`https://{subdomain}.poultryhero.solutions`

Example: `https://firstview.poultryhero.solutions`

## Architecture

| Host | Purpose |
|------|---------|
| `poultryhero.solutions` | Marketing / root login (redirects tenant users to subdomain) |
| `admin.poultryhero.solutions` | Super Admin dashboard only |
| `{subdomain}.poultryhero.solutions` | Tenant company ERP workspace |

The React SPA is served from the same Nginx `root` for all hosts. API requests from tenant subdomains use **same-origin** `/api` so Django receives the correct `Host` header for login validation.

## DNS (Hostinger)

Add a wildcard A record:

```text
Type   Name   Value
A      *      153.92.5.195
```

Also keep apex records for `@` and `www` if not already present.

Verify:

```bash
dig +short firstview.poultryhero.solutions
dig +short admin.poultryhero.solutions
```

Both should resolve to the VPS IP.

## Nginx

`deploy/nginx/poultryhero.conf` must include wildcard tenant hosts:

```nginx
server_name poultryhero.solutions www.poultryhero.solutions admin.poultryhero.solutions demo.poultryhero.solutions *.poultryhero.solutions;
```

After editing on the VPS:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## SSL / HTTPS

Each new tenant subdomain needs a valid TLS certificate. Options:

1. **Wildcard certificate** for `*.poultryhero.solutions` (recommended) — requires DNS-01 challenge via Certbot.
2. **Per-subdomain certificates** — not scalable; only for temporary testing.

Without wildcard SSL, `https://firstview.poultryhero.solutions` will fail even if application code is correct.

Check:

```bash
curl -I https://firstview.poultryhero.solutions
curl -s https://firstview.poultryhero.solutions/api/v1/health/
```

Expected: HTTP 200 and `{"status":"ok","service":"poultryhero-api"}`.

## Django settings (backend/.env)

Production example values:

```env
DJANGO_ALLOWED_HOSTS=.poultryhero.solutions,poultryhero.solutions,www.poultryhero.solutions,admin.poultryhero.solutions,demo.poultryhero.solutions,153.92.5.195
BASE_DOMAIN=poultryhero.solutions
CORS_ALLOWED_ORIGIN_REGEXES=^https://([a-z0-9-]+)\.poultryhero\.solutions$
```

Run reference seeds after deploy (idempotent, not demo data):

```bash
cd /var/www/poultryhero/backend
python manage.py seed_plans
python manage.py seed_permissions
```

## Frontend build

Deploy with:

```env
VITE_API_BASE=https://poultryhero.solutions/api
VITE_TENANT_BASE_DOMAIN=poultryhero.solutions
VITE_USE_MOCK_DATA=false
```

Runtime behavior:

- On `admin.poultryhero.solutions` → API calls go to `https://admin.poultryhero.solutions/api/...`
- On `firstview.poultryhero.solutions` → API calls go to `https://firstview.poultryhero.solutions/api/...`

## Adding a new tenant company

1. Sign in at `https://admin.poultryhero.solutions` as Super Admin.
2. Create company with unique subdomain (e.g. `firstview`).
3. Create first admin user in the wizard.
4. Open workspace URL: `https://firstview.poultryhero.solutions`
5. Sign in with the tenant admin credentials **on the tenant URL**, not on the admin domain.

## Login rules

| User type | Admin host | Tenant subdomain | Root domain |
|-----------|------------|------------------|-------------|
| Super Admin | Allowed | Blocked | Allowed |
| Tenant user | Blocked | Allowed (own company only) | Redirect to subdomain |

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Subdomain does not resolve | Missing DNS wildcard A record |
| SSL certificate error | Wildcard cert not installed |
| Tenant login works on admin but not subdomain | Old frontend bundle calling wrong API host — redeploy |
| 400 "Super Admin domain" on admin login | Expected for tenant users — use tenant URL |
| 400 "workspace was not found" | Subdomain typo or company not created |
| Empty companies list after create | Wizard not calling API — verify deployed commit includes `createCompany` |

## Manual smoke checklist

1. `curl -I https://admin.poultryhero.solutions`
2. `curl -s https://admin.poultryhero.solutions/api/v1/health/`
3. `curl -I https://firstview.poultryhero.solutions`
4. `curl -s https://firstview.poultryhero.solutions/api/v1/health/`
5. Super Admin creates company `firstview`
6. Tenant URL shown as `https://firstview.poultryhero.solutions`
7. Tenant owner logs in on tenant URL → ERP dashboard
8. Same tenant credentials on admin host → access denied screen
