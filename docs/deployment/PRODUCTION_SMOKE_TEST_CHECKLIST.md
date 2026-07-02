# Poultry Hero Production Smoke Test Checklist

## Environment sanity
- [ ] `VITE_USE_MOCK_DATA=false`
- [ ] `VITE_API_BASE` points to production API
- [ ] Browser console has no critical API/config errors

## Auth and tenancy
- [ ] Login works
- [ ] Logout works
- [ ] Super Admin dashboard loads real companies
- [ ] Create company manually from dashboard (if enabled)
- [ ] Tenant user login works
- [ ] Empty tenant dashboard shows zeros/empty states

## Core ERP flow
- [ ] Create product
- [ ] Create customer
- [ ] Create supplier
- [ ] Add opening stock
- [ ] Create purchase draft
- [ ] Approve purchase
- [ ] Create sales draft
- [ ] Approve sale
- [ ] Collect customer payment
- [ ] Create quotation and convert to sales
- [ ] Create expense
- [ ] Generate tax warnings
- [ ] Open reports

## Print and UX
- [ ] Print preview works for sales / quotation / purchase / receipt / expense / refund voucher
- [ ] No demo data appears in production screens
- [ ] Mobile layout is usable on key screens
- [ ] Permission-denied screens render correctly for restricted users

## Settings and users (Phase 4B)
- [ ] Company profile loads/saves from API
- [ ] VAT settings load/save from API
- [ ] Numbering settings load/save from API
- [ ] Print template settings load/save from API
- [ ] Users list/create/suspend/reactivate work
- [ ] User permission override screen loads catalog and saves overrides (owner only)
- [ ] Logo/stamp/signature upload shows unavailable if backend has no upload endpoint

## Customer / supplier profiles (Phase 4B)
- [ ] Customer profile tabs show live data or empty/unavailable (no fake invoice rows)
- [ ] Supplier profile tabs show live data or empty/unavailable
- [ ] Customer collection modal allocates to invoices in live mode
- [ ] Supplier payment modal allocates in live mode

## Payments and cancellations (Phase 4B)
- [ ] Customer refund records via API and opens print preview
- [ ] Supplier refund records via API
- [ ] Payment movement cancellation requires reason and updates list
- [ ] Expense cancellation from read-only detail works

## Attachments (Phase 4B)
- [ ] Purchase/expense attachment panel uploads or shows unavailable
- [ ] No fake attachment rows in production

## Reports (Phase 4B)
- [ ] Export JSON preview includes active date range and report type
- [ ] PDF/Excel export buttons remain disabled until backend supports files

## Product edit (Phase 4)
- [ ] Product edit route loads existing product and PATCH saves

## Commands
```bash
cd frontend
corepack pnpm run typecheck
corepack pnpm run build
```

If backend changed:
```bash
cd backend
python manage.py check
pytest
```

## Deployment run
- [ ] Run deployment script/runbook steps
- [ ] Validate smoke URLs:
  - [ ] https://admin.poultryhero.solutions
  - [ ] https://poultryhero.solutions
