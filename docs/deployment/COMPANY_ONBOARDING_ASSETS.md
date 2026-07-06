# Company Onboarding & Identity Assets

## Overview

Company logo, stamp, authorized signature, and TRN are stored on the **`Company`** model (single source of truth). `PrintTemplateSettings` only controls visibility flags (`show_logo`, `show_stamp`, etc.) — not the asset files themselves.

## Model fields (`apps.tenants.models.Company`)

| Field | Type | Notes |
|-------|------|-------|
| `logo` | `ImageField` | `company_assets/{company_id}/logo/{uuid}.ext` |
| `stamp` | `ImageField` | `company_assets/{company_id}/stamp/{uuid}.ext` |
| `signature` | `ImageField` | `company_assets/{company_id}/signature/{uuid}.ext` |
| `trn` | `CharField(32)` | Digits only when provided |

### Validation

- Allowed image types: PNG, JPG, JPEG, WEBP
- Max size: 2 MB per file
- SVG and non-image content rejected
- TRN: digits only (length not hard-blocked)

## API endpoints

### Super Admin

- `GET/PATCH /api/v1/admin/companies/{id}/`
- Multipart PATCH supports `logo`, `stamp`, `signature`, `trn`, and text fields
- Response includes `logo_url`, `stamp_url`, `signature_url` (absolute HTTPS in production)

### Tenant

- `GET /api/v1/tenant/settings/` — requires `settings.view`
- `PATCH /api/v1/tenant/settings/company/` — requires `settings.manage` (Owner/Admin)

Send empty string for an image field to remove it.

## Print preview integration

Print-preview JSON includes company identity via `apps.tenants.print_identity.build_company_print_identity` and absolute asset URLs when served through DRF request context.

See also: [INVOICE_BRANDING_AND_TAX_IDENTITY.md](./INVOICE_BRANDING_AND_TAX_IDENTITY.md)

```json
{
  "company": {
    "name_ar": "...",
    "name_en": "...",
    "trn": "...",
    "phone": "...",
    "address": "...",
    "logo_url": "...",
    "stamp_url": "...",
    "signature_url": "..."
  }
}
```

Supported for: sales, purchase, quotation, payment receipts, expense vouchers.

Frontend `PrintPreviewLayout` renders logo/TRN in header, stamp near totals, signature in footer. Missing assets are hidden cleanly (no broken icons).

## Media serving

Production Nginx (see `deploy/nginx/poultryhero.ssl.example.conf`):

```nginx
location /media/ {
    alias /var/www/poultryhero/backend/media/;
}
```

Django: `MEDIA_URL=/media/`, `MEDIA_ROOT=/var/www/poultryhero/backend/media/`

## Permissions

| Role | View identity | Update identity |
|------|---------------|-----------------|
| Super Admin | Yes | Yes |
| Owner/Admin | Yes | Yes (`settings.manage`) |
| Accountant | Yes | No |
| Cashier | No (settings) | No |

## Migrations

```bash
cd backend
python manage.py migrate
```

Includes:

- `tenants.0002_alter_company_logo_alter_company_signature_and_more`
- `company_settings.0002_alter_numberingsettings_document_type` (migration drift fix)

## Tests

```bash
cd backend
python -m pytest tests/test_company_identity.py
```

## Production verification (First View)

1. Super Admin → company detail → **Company Identity** tab → upload logo/stamp/signature + TRN
2. Tenant → Settings → Company Profile → confirm assets persist
3. Sales/purchase print preview → logo, TRN, stamp, signature visible
4. Browser Print → Save as PDF → images included

## Remaining manual steps

- Deploy to VPS: `git pull && bash scripts/deploy_vps.sh && python manage.py migrate`
- Upload real First View assets via Super Admin (do not commit production images to Git)
- Verify `curl -I https://firstview.poultryhero.solutions/media/` returns 200/403 (not 404 from missing nginx block)
