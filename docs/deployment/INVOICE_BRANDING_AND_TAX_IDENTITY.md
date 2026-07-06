# Invoice Branding & Tax Identity

## Overview

Official invoices, quotations, receipts, and vouchers render **company identity** (name, TRN, logo, stamp, signature) and **customer tax identity** (TRN snapshot on sales) from live API print-preview JSON. No hardcoded assets or base64 in frontend source.

## Company identity (`Company` model)

| Field | Storage |
|-------|---------|
| `name_ar`, `name_en` | CharField |
| `trn` | CharField — digits only when provided |
| `phone`, `address`, `email` | Contact fields in header |
| `logo`, `stamp`, `signature` | `ImageField` under `company_assets/{company_id}/{kind}/` |

Validation: PNG/JPG/JPEG/WEBP, max 2 MB.

### APIs

- Super Admin: `GET/PATCH /api/v1/admin/companies/{id}/` (multipart for assets)
- Tenant: `GET /api/v1/tenant/settings/`, `PATCH /api/v1/tenant/settings/company/`

Response includes absolute `logo_url`, `stamp_url`, `signature_url` when request context is available.

## Customer TRN (`Customer.trn`)

- Optional on create/update via `POST/PATCH /api/v1/tenant/customers/`
- Digits-only validation (length not hard-blocked)
- Unique per company when non-empty

## Sales invoice snapshots

On create and when customer is re-selected on draft:

- `customer_name_snapshot`
- `customer_trn_snapshot`
- `customer_phone_snapshot`
- `customer_address_snapshot`

On **approval**, snapshots refresh from current customer data (frozen after approval).

Print preview uses snapshots first; legacy invoices without TRN snapshot fall back to current customer TRN for display only.

## Print preview JSON

Shared builder: `apps.tenants.print_identity.build_company_print_identity`

```json
{
  "title_en": "TAX INVOICE",
  "title_ar": "فاتورة ضريبية",
  "company": {
    "name_ar": "...",
    "name_en": "...",
    "trn": "...",
    "phone": "...",
    "address": "...",
    "email": "...",
    "logo_url": "https://tenant.poultryhero.solutions/media/company_assets/1/logo/....png",
    "stamp_url": "...",
    "signature_url": "..."
  },
  "customer": { "name": "...", "trn": "...", "phone": "...", "address": "..." },
  "party": { "name": "...", "trn": "...", "phone": "...", "address": "..." }
}
```

Implemented for: sales, purchase, quotation, payment receipts, expense vouchers.

## Frontend

- `PrintPreviewLayout` — logo (80px), company TRN, customer TRN, stamp (160px), signature (180px)
- `AdminCompanyEditScreen` — Company Identity & Invoice Branding section
- `CustomerModule` — Customer TRN field on create/edit
- Missing images hidden via `onError` (no broken icon)

## Media / Nginx

```nginx
location /media/ {
    alias /var/www/poultryhero/backend/media/;
}
```

`MEDIA_URL=/media/`, `MEDIA_ROOT=/var/www/poultryhero/backend/media/`

Assets must be served from each tenant subdomain and admin host over HTTPS.

## Production verification

1. Super Admin: upload logo/stamp/signature + TRN for tenant company
2. Tenant: add customer TRN → create sales invoice → print preview
3. Confirm company + customer TRN and images in browser print/PDF
4. Purchase print preview shows company identity

## Security

- Tenant isolation on all company assets and customer data
- Super Admin only cross-tenant company update
- Audit log on company profile updates
