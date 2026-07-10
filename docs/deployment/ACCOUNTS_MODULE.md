# Accounts Module (الحسابات)

## Frontend

- Module: `frontend/src/app/AccountsModule.tsx`
- Service: `frontend/src/services/treasuryService.ts`
- Routes: `accounts`, `accounts-list`, `accounts-new`, `accounts-edit`, `accounts-detail`, `accounts-statement`
- Live mode only — no mock balances

## Backend APIs

| Method | Endpoint |
|--------|----------|
| GET/POST | `/api/v1/tenant/money-accounts/` |
| GET/PATCH/DELETE | `/api/v1/tenant/money-accounts/{id}/` |
| GET | `/api/v1/tenant/money-accounts/{id}/movements/` |
| GET | `/api/v1/tenant/money-accounts/{id}/statement/` |
| POST | `/api/v1/tenant/money-accounts/{id}/adjustments/` |
| POST | `/api/v1/tenant/treasury/transfer/` |
| GET | `/api/v1/tenant/treasury/summary/` |

## Permissions

- `treasury.view`, `treasury.create`, `treasury.update`, `treasury.delete`
- `treasury.adjust`, `treasury.transfer`
- `treasury.movements.view`, `treasury.statement.view`

Run after deploy: `python manage.py seed_permissions`

## Account types

- `cashbox` — physical cash / safe
- `bank` — bank account (name, bank_name, account_number, iban)

Opening balance creates an `opening_balance` movement; `current_balance` updates only via movements.

## Integrations

| Module | Cash | Bank | Credit / unpaid |
|--------|------|------|-----------------|
| Purchases | deduct cashbox | deduct bank | no movement |
| Sales | increase cashbox | increase bank | no movement |
| Customer collection | increase account | increase account | — |
| Supplier payment | decrease account | decrease account | — |
| Refunds | opposite direction | opposite direction | — |
| Expenses (paid) | decrease cashbox | decrease bank | `other` / unpaid → no movement |

## Tests

```bash
cd backend
python manage.py check
python -m pytest tests/test_accounts.py tests/test_purchases.py tests/test_sales.py tests/test_payments.py tests/test_expenses.py tests/test_permissions.py
```

## Deploy steps

```bash
git pull origin main
cd backend && source ../.venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py migrate
python manage.py seed_permissions
cd .. && bash scripts/deploy_vps.sh
bash scripts/check_no_production_mock_data.sh
```
