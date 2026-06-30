# Poultry Hero — Open Questions & High-Risk Decisions

> Unresolved decisions that affect schema, API, or business logic. **Not invented or
> silently assumed** — each needs a product/stakeholder answer before the related code is
> built. Grouped by area; each has a default leaning where one exists, but the default is
> *not* a decision.

## A. SaaS plans & subscriptions

1. **Exact plan feature limits** for Basic / Pro / Enterprise: user limits per plan
   (only the base default of 3 is known), which modules each plan enables, and price
   defaults. *Blocks:* `Plan` seed data + module gating.
2. **Suspended tenant behavior:** does a suspended company become fully blocked, read-only,
   or login-blocked with a billing notice? *Blocks:* auth/tenant middleware.
3. **Trial expiry:** does `trial` auto-transition to `suspended`/`active`, and after how
   long? Is there a trial end date field needed on the subscription?
4. **Outstanding balance semantics:** is `outstanding_amount` manually set by Super Admin,
   or auto-accrued from renewal date + price? *Blocks:* subscription billing logic.
5. **Billing cycle switch:** can a company move monthly ↔ yearly mid-cycle, and how is
   proration handled (if at all, given manual billing)?

## B. Tenancy & domains

6. **Multiple branches per company later?** Schema currently assumes one stock location
   and no branch dimension. If branches are coming, a `branch_id` on tenant-owned data
   would be far cheaper to add now than retrofit. *High risk.*
7. **Subdomain provisioning:** is the subdomain immutable after creation? Reserved names
   (`admin`, `www`, `api`)? Who owns DNS/wildcard cert automation?
8. **Custom domains** (e.g. a tenant's own domain) ever required?

## C. Auth & security

9. **Token vs cookie auth:** JWT bearer is the current recommendation (matches
   `client.ts`); confirm vs httpOnly cookie session scoped to `.poultryhero.solutions`.
10. **Password reset flow** + email provider (none specified; email backend TBD).
11. **Session lifetime / forced logout** on suspend or permission change.
12. **2FA** for Super Admin — required now or later?

## D. Permissions & roles

13. **Per-company permission default overrides:** can a tenant Admin change role *defaults*
    company-wide, or only per-user overrides? Schema currently supports per-user overrides
    + global role defaults.
14. **Cashier/Sales exact capabilities:** confirm the default permission matrix for each of
    the 3 roles (which sensitive actions each may perform). *Blocks:* `RolePermissionDefault`
    seed.

## E. Inventory / FIFO / costing

15. **FIFO unit basis:** is FIFO tracked/consumed by **KG** (recommended, normalized) or by
    carton/piece? Mixed-unit consumption + rounding needs a rule. *High risk for COGS.*
16. **Rounding policy:** decimal places + rounding mode for KG (3dp?), money (2dp), VAT,
    and KG×price line amounts. *Affects every financial total.*
17. **Negative stock hard block vs override:** confirmed no negative stock — but is there
    any authorized override path, or is it absolute?
18. **Opening stock entry:** how is initial inventory seeded (opening stock layers with what
    cost)? Needs an `opening` layer source flow.
19. **Inventory adjustment loss accounting:** should a downward stock adjustment / stocktaking
    shortage automatically create an expense/loss record? (Also listed in I.)

## F. Sales / customers

20. **Credit-limit boundary:** is the limit inclusive or exclusive (block when
    `balance + invoice > limit` vs `>=`)?
21. **Free products & VAT:** are free lines VAT-taxable (deemed supply) or zero-rated? UAE
    VAT treatment matters. *Compliance.*
22. **Special price precedence:** customer special price vs manual line override vs default
    price — exact precedence order.
23. **Collection adjustment accounting:** is a post-approval discount a reduction of revenue,
    an expense, or a contra to receivable? *Affects profit + statement.*

## G. Purchases / suppliers

24. **Purchase cost → FIFO normalization:** when purchased by carton/piece/tray, how is
    per-KG layer cost derived (esp. for variable-weight birds)?
25. **Slaughter / transport deductions:** do agreement default deductions reduce supplier
    payable, add to inventory cost, or both? Confirm per deduction type.
26. **Partial purchase cancel** after partial sale: fully blocked (current assumption) or
    allow cancelling the unsold remainder?

## H. VAT / tax compliance

27. **Exact UAE VAT compliance requirements:** FTA filing format, VAT return periods,
    reverse charge, exempt vs zero-rated categories — what must the schema/report support
    now vs later? *High risk / compliance.*
28. **Tax credit notes:** timeline and legal numbering for credit notes (placeholder today).
29. **TRN validation:** validate TRN format, or store free-text with warning only?

## I. Payments / receipts / expenses

30. **Receipt numbering & legal requirements:** must receipts have gapless legal sequences,
    immutability, mandatory fields? *Compliance.*
31. **Refund handling:** does a refund require linking to an original receipt/invoice, and
    can it exceed paid amount?
32. **Auto loss/expense from inventory adjustments** (see 19) — confirm desired behavior.

## J. Files / storage / integrations

33. **Production file storage provider:** S3? Cloudflare R2? Hostinger object storage?
    Local disk only initially? *Blocks:* `django-storages` config.
34. **WhatsApp integration provider** (premium feature lock): which provider/API (Meta
    Cloud API, Twilio, etc.), and what exactly is gated by the premium flag?
35. **PDF generation engine** for invoices/receipts/quotations (WeasyPrint, wkhtmltopdf,
    server-side React?) and template authoring model.

## K. Audit / data integrity

36. **Database-level audit immutability:** must `AuditLog` (and ledgers) be enforced
    append-only at the DB level (triggers / revoked UPDATE/DELETE), or is app-level
    discipline sufficient? *Risk/compliance.*
37. **Double-entry ledger:** should the financial model evolve into a proper double-entry
    accounting ledger in the future? Designing balances as derived-from-ledger now would
    ease that; current design keeps running balances on Customer/Supplier.
38. **Data retention / tenant deletion:** on tenant offboarding, hard delete, anonymize, or
    archive? Legal retention period for financial records (UAE)?

## L. Frontend contract

39. **Money wire format:** decimal string vs number vs integer minor units. Current frontend
    `MoneyAmount = number`; switching to string is safer for precision but is a typed change.
40. **Date/timezone:** all dates in company-local TZ or UTC? UAE is fixed UTC+4 (no DST),
    which simplifies but should be confirmed.
41. **Pagination defaults:** default `page_size`, max page size, and whether some lists are
    returned unpaginated (the mock services currently return full arrays).

---

### Recommended resolution order (highest leverage first)
1. Branches now-or-later (#6) — structural.
2. FIFO unit basis + rounding (#15, #16) — affects all costing/financials.
3. Role permission matrix + plan limits (#14, #1) — blocks Phase 1 seeds.
4. VAT compliance scope (#27) — affects schema + reports.
5. Money wire format + timezone (#39, #40) — frontend contract.
