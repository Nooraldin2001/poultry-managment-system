# Invoice Branding and Templates

**Phase:** Invoice print redesign — company-level template + color theme settings applied to sales/purchase print previews.

## Template keys

| Key | Arabic | English | Description |
|-----|--------|---------|-------------|
| `classic` | كلاسيكي | Classic | Simple traditional layout |
| `modern` | عصري | Modern | Bold solid-color header |
| `bilingual` | ثنائي اللغة | Bilingual | Forces AR/EN side-by-side labels |
| `firstview_style` | النمط الرسمي | Official Style | Dark header, colored title strip, logo/stamp/signature (default) |

## Color theme keys

| Key | Arabic | English |
|-----|--------|---------|
| `navy_red` | كحلي وأحمر | Navy / Red (default) |
| `royal_blue` | أزرق ملكي | Royal Blue |
| `emerald` | زمردي | Emerald |
| `charcoal_gold` | فحمي وذهبي | Charcoal / Gold |
| `teal` | أزرق مخضر | Teal |
| `crimson` | قرمزي | Crimson |
| `purple` | بنفسجي | Purple |

Each theme exposes tokens: `primary`, `secondary`, `accent`, `headerBg`, `titleBg`, `tableHeaderBg`, `border`, `text`, `muted`.

## Backend model

`InvoiceDesignSettings` (1—1 with `Company`, lazy-created):

- `invoice_template_key` (default `firstview_style`)
- `invoice_color_theme` (default `navy_red`)
- `show_logo`, `show_stamp`, `show_signature`
- `show_company_trn`, `show_company_phone`
- `show_customer_trn`, `show_supplier_trn`
- `show_bilingual_labels`

Migration: `company_settings/0003_invoicedesignsettings.py`

Existing `PrintTemplateSettings` (per document type) is **unchanged** — it still controls receipt/voucher templates.

## API endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/tenant/settings/print-template/` | `settings.view` |
| PATCH | `/api/v1/tenant/settings/print-template/` | `settings.manage` |
| GET | `/api/v1/tenant/settings/print-template/catalog/` | `settings.view` |

## Print preview JSON (`branding` block)

Sales and purchase print previews now include:

```json
{
  "branding": {
    "template_key": "firstview_style",
    "color_theme": "navy_red",
    "show_logo": true,
    "show_stamp": true,
    "show_signature": true,
    "show_company_trn": true,
    "show_company_phone": true,
    "show_customer_trn": true,
    "show_supplier_trn": true,
    "show_bilingual_labels": true
  },
  "company": { "name_ar", "name_en", "trn", "phone", "email", "address", "logo_url", "stamp_url", "signature_url" },
  "party": { "name", "name_ar", "name_en", "trn", "phone", "address" },
  "invoice": { "invoice_number", "date", "status", "title_ar", "title_en" },
  "lines": [],
  "totals": { "subtotal", "vat_amount", "total_amount", "amount_paid", "balance_due" }
}
```

Sales: `party.trn` uses `customer_trn_snapshot` first, falls back to current customer TRN.

Purchase: `party.trn` uses `supplier_trn_snapshot` first, falls back to current supplier TRN.

## Frontend

- Template registry: `frontend/src/features/print/templateRegistry.ts`
- Theme tokens: `frontend/src/features/print/theme.ts`
- Templates: `frontend/src/features/print/templates/InvoiceTemplate*.tsx`
- Shared components: `frontend/src/features/print/components/`
- Renderer: `frontend/src/features/print/InvoiceTemplateRenderer.tsx`
- A4 print shell: `frontend/src/features/print/PrintA4Shell.tsx` + `print-a4.css`
- Settings UI: Settings → **تصميم الفواتير / Invoice Design** (`settings-invoice-design`)
- Print CSS: `frontend/src/features/print/print-a4.css` (fixed 210mm A4; mobile-safe print; app chrome hidden)

### Mobile print (2026-07-08)

- **Problem:** iPhone PDF showed invoice scaled to viewport (~390px), blank second page, app chrome bleeding into print.
- **Fix:** mm-based `.invoice-a4-page` inside `.print-shell`; removed legacy `visibility:hidden` + `width:100%` hack.
- **Print button:** `triggerPrint()` waits two animation frames before `window.print()` for mobile Safari layout settle.
- See [INVOICE_PRINT_PAGINATION.md](./INVOICE_PRINT_PAGINATION.md) for verification checklist.

## Tests run

```bash
cd backend
python manage.py check
python -m pytest tests/test_invoice_branding.py tests/test_settings.py tests/test_sales.py tests/test_purchases.py tests/test_company_identity.py tests/test_admin_companies.py tests/test_customers.py

cd frontend
corepack pnpm run typecheck
corepack pnpm run build
```

**Result:** 188 backend tests passed; frontend typecheck/build passed.

## Production verification

1. Super Admin → edit company → upload logo/stamp/signature, add TRN.
2. Tenant login → Settings → Invoice Design → choose template + theme → Save.
3. Create sales invoice → Print preview → confirm logo, TRN, stamp, signature, customer TRN.
4. Open purchase print preview → confirm company branding + supplier TRN.
5. Change template/color → reopen preview → confirm design changes.

## Deployment

```bash
cd /var/www/poultryhero
git pull origin main
bash scripts/deploy_vps.sh
bash scripts/check_no_production_mock_data.sh
```

Run migration on deploy: `python manage.py migrate company_settings`
