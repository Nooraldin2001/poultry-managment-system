# Poultry Hero — Backend Architecture

> **Design only.** No Django code, apps, or migrations are created by this document.
> This is the architectural blueprint for the future backend that will replace the
> mock service layer (`Poultry managment system/src/services/`).

---

## 1. Technology stack recommendation

| Concern | Choice | Notes |
| --- | --- | --- |
| Language | Python 3.12+ | |
| Web framework | Django 5.x | LTS-track, stable ORM, admin for ops |
| API layer | Django REST Framework (DRF) | Serializers + ViewSets + routers |
| Auth | `djangorestframework-simplejwt` (JWT bearer) | Matches `client.ts` `Authorization` header seam; email/password only |
| Database | PostgreSQL 15+ (prod), PostgreSQL (dev too) | Single shared DB, tenant isolation by `company_id` |
| Cache / broker | Redis | Cache + Celery broker (later) |
| Background jobs | Celery + Redis (placeholder) | Recurring expenses, quotation expiry, report rollups |
| Config | `django-environ` (`.env`) | 12-factor env vars |
| Static/Media | WhiteNoise (static) + local media now, S3-compatible later (`django-storages`) | |
| API schema/docs | `drf-spectacular` (OpenAPI 3) | Generates schema the frontend can type against |
| Filtering | `django-filter` | `?search=&page=&page_size=` per `ListParams` |
| CORS | `django-cors-headers` | Allow tenant subdomains |
| WSGI/ASGI server | Gunicorn (WSGI) behind Nginx | ASGI optional later |
| Testing | `pytest` + `pytest-django` + `factory_boy` | |
| Lint/format | `ruff` + `black` + `mypy` (optional) | |
| Money | `Decimal` via `DecimalField(max_digits=14, decimal_places=2)` | Never float |

**Why JWT bearer:** the existing frontend `src/services/api/client.ts` is stubbed to send an
`Authorization` header. Bearer tokens map cleanly. (Cookie-session auth scoped to
`.poultryhero.solutions` is a viable alternative — see OPEN_QUESTIONS.)

---

## 2. Django project structure

```
backend/
  manage.py
  pyproject.toml / requirements.txt
  .env.example
  config/                      # project package (settings/urls/wsgi/asgi)
    settings/
      base.py
      dev.py
      prod.py
    urls.py
    wsgi.py
    asgi.py
    celery.py
  apps/
    core/                      # base models, mixins, tenant context, utils
    accounts/                  # auth: login/refresh/logout, password
    tenants/                   # Company/Tenant (super-admin owned)
    subscriptions/             # plans, status, manual SaaS payments
    users/                     # custom User, membership in a company, roles
    permissions/               # permission catalog, role defaults, user overrides, module gating
    products/                  # products, categories, price types
    customers/                 # customers, special prices, credit, statements
    suppliers/                 # suppliers, agreements, special prices, statements
    sales/                     # sales invoices + lines + approval/cancel
    quotations/                # quotations + lines + convert
    purchases/                 # purchase invoices + lines + adjustments
    inventory/                 # balances, FIFO cost layers, stock movements, stocktaking
    payments/                  # collections, supplier payments, receipts, refunds
    expenses/                  # expenses, recurring, purchase-linked
    tax/                       # VAT settings, VAT records, summaries
    reports/                   # report aggregation + summary placeholders
    settings/                  # company settings, numbering, print templates
    audit/                     # audit log, sensitive-action reasons
    documents/                 # file attachments (uploads, generated PDFs)
  tests/
```

Each app: `models.py`, `serializers.py`, `services.py` (business logic), `selectors.py`
(read queries), `views.py` (DRF), `urls.py`, `permissions.py`, `admin.py`, `tests/`.

---

## 3. Apps / modules structure (responsibility map)

| App | Owns | Tenant-scoped? |
| --- | --- | --- |
| `core` | Abstract base models (`TimeStampedModel`, `TenantOwnedModel`), tenant context middleware, common enums, money/qty utils | n/a |
| `accounts` | Login, token refresh, logout, password change/reset | global auth |
| `tenants` | `Company` (the tenant), subdomain, trade license, emirate, enabled modules | **super-admin owned (global)** |
| `subscriptions` | `Plan`, `CompanySubscription`, `SubscriptionPayment` (manual), outstanding balance | global (about a company) |
| `users` | `User` (custom, email login), `CompanyMembership`/role | mixed (user belongs to one company; super admin has none) |
| `permissions` | `PermissionCatalog`, `RolePermissionDefault`, `UserPermissionOverride`, `ModuleAccess` | tenant for overrides |
| `products` | `Category`, `Product`, price types, weight grades | tenant |
| `customers` | `Customer`, `CustomerSpecialPrice`, `CustomerFreeProduct`, opening balance | tenant |
| `suppliers` | `Supplier`, `SupplierAgreement`, `SupplierSpecialPrice`, opening balance | tenant |
| `sales` | `SalesInvoice`, `SalesInvoiceLine` | tenant |
| `quotations` | `Quotation`, `QuotationLine` | tenant |
| `purchases` | `PurchaseInvoice`, `PurchaseInvoiceLine`, `PurchaseAdjustment` | tenant |
| `inventory` | `InventoryBalance`, `StockLayer` (FIFO), `StockMovement`, `StockAdjustment`, `StocktakingSession`, `StocktakingLine` | tenant |
| `payments` | `PaymentMovement` (collection/payment/refund), `Receipt`, allocations | tenant |
| `expenses` | `ExpenseCategory`, `Expense`, `RecurringExpense` | tenant |
| `tax` | `VatSettings`, `VatRecord`, `TaxCreditNote` (placeholder) | tenant |
| `reports` | Aggregation selectors, optional `ReportSnapshot` materialization | tenant |
| `settings` | `CompanySettings`, `NumberingSequence`, `PrintTemplate` | tenant |
| `audit` | `AuditLog`, `SensitiveActionReason` | tenant (+ global super-admin events) |
| `documents` | `FileAttachment` (generic FK), generated PDFs | tenant |

---

## 4. SaaS tenancy strategy

**Model: shared database, shared schema, row-level isolation by `company_id`.**

- `tenants.Company` is the tenant root. It is **super-admin owned and global** (not
  itself tenant-scoped).
- Every tenant-owned model inherits `core.TenantOwnedModel`:
  ```
  class TenantOwnedModel(TimeStampedModel):
      company = ForeignKey("tenants.Company", on_delete=PROTECT, db_index=True)
      class Meta: abstract = True
  ```
- **Tenant context middleware** resolves the active company from the request:
  1. From the authenticated user's `company` (primary source of truth), AND
  2. Validated against the request subdomain (`primefresh.poultryhero.solutions` →
     `Company.subdomain == "primefresh"`). Mismatch → 403.
  3. `admin.poultryhero.solutions` → Super Admin scope (no tenant context).
- The active company is stored in a request-local (thread-local/`contextvars`) so a
  default manager (`TenantManager`) can auto-filter `objects` by `company_id`, plus an
  explicit `all_objects` manager for super-admin/maintenance.
- **Writes** always stamp `company` from context; serializers never accept `company`
  from the client.
- Super Admin endpoints (`/api/v1/admin/...`) bypass tenant filtering and may target a
  specific company via path/param.

**Uniqueness pattern:** tenant-scoped unique fields are unique *per company*, e.g.
`UniqueConstraint(fields=["company", "code"])` for product SKU, invoice numbers, etc.

---

## 5. Authentication strategy

- **Email/password only.** Custom user model `users.User` with `USERNAME_FIELD = "email"`.
- JWT via `simplejwt`: `POST /auth/login/` → `{access, refresh}`; `POST /auth/refresh/`;
  `POST /auth/logout/` (blacklist refresh). Access token carries `user_id`, `company_id`,
  `role`, `is_superuser`.
- Password hashing via Django's default (PBKDF2/Argon2 — recommend Argon2).
- No social login, no online payment gateway, no SMS/OTP in this phase.
- Super Admin = `is_superuser`/`is_staff` user with `company = NULL`.
- Tenant user = `company` set, `role ∈ {owner, accountant, cashier}`.

---

## 6. Permissions strategy

Three layers, evaluated in order:

1. **Plan/module gating** — `Company.enabled_modules` (driven by subscription plan)
   gates whole modules. If a module is off, all its endpoints 403.
2. **Role defaults** — `RolePermissionDefault(role, permission_code, allowed)` seeds
   defaults for `owner | accountant | cashier`.
3. **Per-user overrides** — `UserPermissionOverride(user, permission_code, allowed)`
   lets an Owner/Admin customize a single user (grant or revoke vs. role default).

Effective permission = override (if present) else role default, AND module enabled.

- **Sensitive actions** (see BUSINESS_RULES) require a permission AND a `reason` payload;
  the action writes an `AuditLog` row with the reason. Enforced by a DRF permission class
  + a service-layer guard.
- **User limit** is enforced at user creation: `active users < plan.user_limit`
  (default plan = 3).

---

## 7. Audit log strategy

- `audit.AuditLog`: append-only table; rows are never updated/deleted by app code.
  Fields include `company` (nullable for super-admin events), `actor` (user), `action`
  (enum/code), `entity_type`, `entity_id`, `reason` (required for sensitive actions),
  `changes` (JSON before/after), `ip`, `created_at`.
- Writes happen inside the same `transaction.atomic()` block as the action they record,
  via a `audit.services.record()` helper, so an action and its audit row commit together.
- Sensitive actions cannot proceed without a non-empty `reason`.
- DB-level immutability (triggers / append-only) is an OPEN QUESTION (see that doc).

---

## 8. Service layer strategy

- **Fat services, thin views.** All business logic (FIFO consumption, balance updates,
  approval side effects, reversals) lives in `apps/<app>/services.py` functions, not in
  serializers or views.
- Every state-changing service runs in `transaction.atomic()`. Inventory + balance +
  movement + audit writes are atomic together.
- **Selectors** (`selectors.py`) hold read/query logic (statements, reports) to keep
  views declarative.
- Side-effecting operations (approve/cancel/collect/pay/adjust) are explicit service
  functions, e.g. `sales.services.approve_invoice(invoice, actor, reason=None)`.
- `select_for_update()` on stock layers / balances during approval to avoid races and
  prevent negative stock.

---

## 9. API layer strategy

- DRF `ViewSet`s + routers under versioned base `/api/v1/`.
- Resource-oriented, plural, lowercase paths (mirrors `API_BOUNDARY_PLAN.md`).
- Custom actions for side effects: `POST /sales/invoices/{id}/approve/`,
  `.../cancel/`, `POST /purchases/invoices/{id}/approve/`, etc.
- Pagination: page-number pagination (`page`, `page_size`); filtering via `django-filter`;
  `search` param on list endpoints.
- Consistent error envelope: `{detail, code, fields?}`.
- OpenAPI schema published via `drf-spectacular` at `/api/v1/schema/` (+ Swagger UI in dev).
- Two router trees: `admin/` (super-admin) and tenant resources (default).

---

## 10. Background jobs (placeholder)

Celery + Redis, introduced when needed. Planned tasks:
- Generate due **recurring expenses** (daily beat).
- Expire **quotations** past `expiry_date` (daily beat).
- Materialize **report snapshots** / dashboard KPIs (periodic).
- Future: email receipts, WhatsApp send (premium), subscription renewal reminders.

Until Celery is wired, these can run as idempotent management commands via cron.

---

## 11. File / media storage strategy

- `documents.FileAttachment` with a generic relation (entity_type + id) for: uploaded
  original supplier invoices, generated invoice/receipt/quotation PDFs, print template
  assets, company logo.
- Dev/early-prod: local `MEDIA_ROOT` on the VPS.
- Production target: S3-compatible object storage via `django-storages` (provider TBD —
  see OPEN_QUESTIONS). Private files served via signed URLs.
- Validate content type + size; store under `media/<company_id>/<entity>/...` for
  tenant separation.

---

## 12. Deployment notes (VPS / Hostinger)

- Ubuntu LTS VPS. Components: PostgreSQL, Redis, Gunicorn (systemd service), Nginx
  (reverse proxy + TLS), Certbot.
- **Wildcard TLS** for `*.poultryhero.solutions` (DNS-01 challenge) so every tenant
  subdomain + `admin.` is HTTPS.
- Nginx routes all `*.poultryhero.solutions` to the same Gunicorn upstream; Django reads
  the `Host` header to resolve tenant.
- Static via WhiteNoise or Nginx; media from `MEDIA_ROOT` (or S3 later).
- Process: `gunicorn config.wsgi --workers N`; Celery worker + beat as separate systemd
  units (when added).
- Backups: nightly `pg_dump` + media backup; retention policy TBD.

---

## 13. Environment variables

```
DJANGO_SETTINGS_MODULE=config.settings.prod
SECRET_KEY=...
DEBUG=false
ALLOWED_HOSTS=.poultryhero.solutions
CSRF_TRUSTED_ORIGINS=https://*.poultryhero.solutions
DATABASE_URL=postgres://user:pass@host:5432/poultryhero
REDIS_URL=redis://localhost:6379/0
CORS_ALLOWED_ORIGIN_REGEXES=^https://([a-z0-9-]+\.)?poultryhero\.solutions$
JWT_ACCESS_LIFETIME_MIN=30
JWT_REFRESH_LIFETIME_DAYS=7
BASE_DOMAIN=poultryhero.solutions
SUPERADMIN_SUBDOMAIN=admin
DEFAULT_VAT_RATE=5.00
DEFAULT_PLAN_USER_LIMIT=3
MEDIA_BACKEND=local            # local | s3
# S3 (later): AWS_*, S3 endpoint, bucket
EMAIL_BACKEND=...              # for password reset later
```

---

## 14. Local development setup plan

1. `python -m venv .venv` + install `requirements/dev.txt`.
2. Local PostgreSQL + Redis (Docker compose recommended for parity).
3. `.env` from `.env.example`; `DJANGO_SETTINGS_MODULE=config.settings.dev`.
4. `migrate` → seed: one Super Admin, plans, one demo Company + admin user + demo data
   (a `seed_demo` management command mirroring the current mock data).
5. Run API at `http://localhost:8000`; point frontend `API_CONFIG.baseUrl` there and flip
   `useMock=false` for integration testing. Use `*.localhost` or `/etc/hosts` entries
   (e.g. `primefresh.localhost`) to exercise subdomain tenancy locally.

---

## 15. Production deployment considerations

- `DEBUG=false`, strict `ALLOWED_HOSTS`, HSTS, secure cookies, `SECRET_KEY` from env.
- DB connection pooling (PgBouncer) when load grows.
- Per-tenant data export/delete capability (data ownership / future compliance).
- Structured logging + error tracking (Sentry) — provider TBD.
- Migrations applied on deploy; zero-downtime not required initially.
- Rate limiting on `/auth/login/`.
- Indices on every `company_id` + frequent filter columns (see DATABASE_SCHEMA).

---

## 16. Enforced design invariants (carry into every app)

1. Shared DB, tenant isolation via `company_id`; Super Admin data global.
2. No negative stock — ever.
3. FIFO is the only costing method.
4. **Draft** documents never touch inventory or balances.
5. **Approval** triggers inventory + accounting side effects (atomic).
6. **Cancellation/reversal** is auditable and reverses side effects when permitted.
7. Every **sensitive action** requires a `reason` and writes an `AuditLog`.
8. **User limits** depend on the SaaS plan (default 3).
9. **Email/password** login only.
10. **Manual** SaaS subscription payments only (no gateway).
