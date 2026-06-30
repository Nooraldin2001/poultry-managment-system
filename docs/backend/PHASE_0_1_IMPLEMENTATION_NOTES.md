# Poultry Hero — Phase 0/1 Implementation Notes

> Backend **foundation** only: project setup, SaaS tenancy, authentication, users,
> permissions, settings, and audit logs. No business modules (products, sales,
> purchases, inventory, payments, expenses, quotations, reports, tax reports) were
> implemented — those are later phases.

## What was implemented

- Django 5.1 + DRF + SimpleJWT project under `backend/` with split settings
  (`base` / `local` / `production` / `test`), `django-environ`, `drf-spectacular`,
  CORS, UAE timezone (`Asia/Dubai`), and SQLite-for-dev / PostgreSQL-for-prod via
  `DATABASE_URL`.
- Custom email/password user model (Super Admin vs tenant users + 3 tenant roles).
- Company/tenant model with validated subdomain + non-blocking tenant-resolution
  middleware placeholder.
- SaaS plans, per-company subscription, and manual subscription payments.
- Plan-based tenant user-limit enforcement (default/Basic = 3).
- Role default permissions + per-user overrides + effective-permission checker.
- Company settings foundation: VAT settings, numbering settings, print templates.
- Append-only audit log + sensitive-action registry + reason enforcement pattern.
- Seed commands for plans and permissions, and a `seed_initial` convenience command.
- DRF endpoints for auth, Super Admin company/plan/payment management, and tenant
  users/permissions/settings/audit.
- Django admin for all foundation models (AuditLog is fully read-only).
- 50 tests (pytest) covering the phase acceptance criteria — all passing.

## Apps created (`backend/apps/`)

| App | Label | Responsibility |
| --- | --- | --- |
| `core` | `core` | Base models, tenancy util/middleware, DRF permission classes, pagination |
| `accounts` | `accounts` | Custom `User`, JWT auth, tenant user management |
| `tenants` | `tenants` | `Company`, provisioning service, subdomain validation |
| `subscriptions` | `subscriptions` | `Plan`, `CompanySubscription`, `SubscriptionPayment` |
| `permissions` | `tenant_permissions` | `PermissionCode`, `RolePermissionDefault`, `UserPermissionOverride`, checker |
| `company_settings` | `company_settings` | `VATSettings`, `NumberingSettings`, `PrintTemplateSettings` |
| `audit` | `audit` | `AuditLog`, sensitive-action registry, audit services |

> Note: the permissions app uses label `tenant_permissions` to avoid ambiguity with
> Django's built-in auth permission concepts.

## Models created

- **tenants:** `Company` (status trial/active/suspended, subdomain, TRN, emirate,
  logo/stamp/signature, etc.).
- **subscriptions:** `Plan`, `CompanySubscription`, `SubscriptionPayment`.
- **accounts:** `User` (email login, `company` FK, `role`, `is_active`,
  `force_password_change`).
- **permissions:** `PermissionCode`, `RolePermissionDefault`, `UserPermissionOverride`.
- **company_settings:** `VATSettings` (1—1), `NumberingSettings` (per doc type),
  `PrintTemplateSettings` (per template type).
- **audit:** `AuditLog` (append-only).
- **core:** abstract bases only (`TimeStampedModel`, `SoftDeleteModel`,
  `TenantOwnedModel`) — no tables.

## Endpoints created (base `/api/v1/`)

**Auth:** `POST auth/login/`, `POST auth/refresh/`, `POST auth/logout/`, `GET auth/me/`.

**Super Admin:** `GET/POST admin/companies/`, `GET/PATCH admin/companies/{id}/`,
`POST admin/companies/{id}/suspend/`, `.../reactivate/`, `.../create-admin-user/`,
`GET admin/plans/`, `GET/POST admin/subscription-payments/`.

**Tenant:** `GET tenant/me/`, `GET tenant/settings/`, `PATCH tenant/settings/company/`,
`GET/POST tenant/users/`, `GET/PATCH tenant/users/{id}/`,
`POST tenant/users/{id}/suspend/`, `.../reactivate/`,
`GET tenant/permissions/`, `GET/PATCH tenant/users/{id}/permissions/`,
`GET tenant/settings/vat/` + `PATCH`, `GET tenant/settings/numbering/` +
`GET/PATCH .../numbering/{id}/`, `GET tenant/settings/print-templates/` +
`GET/PATCH .../print-templates/{id}/`, `GET tenant/audit-logs/`.

**Docs:** `GET api/v1/schema/`, `GET api/v1/docs/` (Swagger UI).

## Seed data created

- `seed_plans` — Basic (3 users), Pro (10, premium+advanced reports),
  Enterprise (50, + future placeholders). Prices are editable in the command.
- `seed_permissions` — 63 permission codes + 189 role defaults (3 roles × 63).
- `seed_initial [--demo] [--superadmin <email> --password <pw>]` — runs both, and
  optionally creates a demo tenant (`primefresh`) and a super admin.

## Tests created (50, all passing)

`backend/tests/`: `test_auth.py`, `test_companies.py`, `test_users.py`,
`test_permissions.py`, `test_settings.py`, `test_audit.py`, `test_tenant_isolation.py`
(+ shared fixtures in `backend/conftest.py`). Covers: email/password login, suspended-
company login block, super-admin company creation, duplicate/invalid/reserved subdomain
rejection, user-limit enforcement (service + API), last-Owner/Admin protection,
role defaults, override changes effective permission, sensitive-action reason enforcement
(VAT/numbering/permission-change), audit creation + append-only, and cross-tenant
isolation of users/permissions/audit.

## Commands to run locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows;  source .venv/bin/activate on *nix
pip install -r requirements/local.txt
copy .env.example .env            # cp on *nix; then edit secrets

python manage.py migrate
python manage.py seed_initial --demo --superadmin admin@poultryhero.solutions --password AdminPass123
python manage.py runserver        # http://127.0.0.1:8000/api/v1/docs/

# checks & tests
python manage.py check
python -m pytest -q
```

Demo credentials after `--demo`: tenant owner `owner@primefresh.test / OwnerPass123`
(subdomain `primefresh`).

## Limitations (intentional for this phase)

- Tenant resolution middleware only annotates `request.tenant`/`request.subdomain`; it
  does **not** yet enforce subdomain↔company matching or block suspended tenants at the
  middleware layer (login does block suspended tenants).
- JWT logout is stateless (client discards tokens); no refresh-token blacklist yet.
- No business modules, no FIFO/inventory/financial logic.
- Audit immutability is enforced at the application layer (model `save`/`delete` guards +
  read-only admin), not at the database level.
- Plan prices/limits are seed defaults pending product sign-off (OPEN_QUESTIONS #1).
- OpenAPI schema for the plain `APIView`s lacks explicit response serializers (graceful
  fallback); `ListCreate`/`RetrieveUpdate` views are fully typed.

## Next recommended phase

Phase 2 — **Product Master, Customers, Suppliers, and opening-balance foundations**
(tenant-owned master data using `TenantOwnedModel`, disable-not-delete, special prices,
agreements, opening balances), building on this foundation.
