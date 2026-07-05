# Inventory Side Effects Audit

**Date:** 2026-07-05

## Business rules (backend — verified)

| Action | Expected | Backend |
|---|---|---|
| Purchase draft | No stock change | Pass — `tests/test_purchases.py` |
| Purchase approve | `add_stock`, FIFO layer, movement, supplier ledger | Pass — `approve_purchase_invoice` |
| Sales draft | No stock change | Pass |
| Sales approve | FIFO consume, movement, customer ledger; block oversell | Pass — `tests/test_sales.py` |
| Double approve | Idempotent (no double add/deduct) | Pass |

## Root cause — client “inventory not updating”

Backend inventory services were correct. Client issues were **frontend workflow**:

1. **Purchase approve** could run before header/lines were fully persisted (`if (!docId) return` silent path).
2. **UI stale inventory** — inventory list refetches on navigation but purchase approve did not persist line qty edits consistently before approve.

## Fix

- `LivePurchaseInvoiceScreen.handleApprove`: `ensureDraft()` → patch header → persist all lines → `POST .../approve/` with `{ "reason": "..." }`.
- Sales live screen already persisted header + reason before approve.

## API endpoints

- `POST /api/v1/tenant/purchases/{id}/approve/` body `{ "reason": "..." }`
- `POST /api/v1/tenant/sales/{id}/approve/` body `{ "reason": "..." }` (+ optional `credit_override`)

## Verification (post-deploy on First View)

1. Note inventory qty for product X.
2. Create purchase draft, add line, save draft → inventory unchanged.
3. Approve with reason → inventory increases; stock movement exists.
4. Create sales draft, approve qty ≤ stock → inventory decreases.
5. Attempt oversell → 400, stock unchanged.
