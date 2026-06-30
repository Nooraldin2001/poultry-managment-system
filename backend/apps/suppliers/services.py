"""Supplier domain services (opening balance, ledger, special prices, agreements).

Balance convention: current_balance = Σcredit − Σdebit (positive = we owe the
supplier / payable). Sensitive-action auditing is performed by the views.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    OpeningBalanceType,
    Supplier,
    SupplierAgreement,
    SupplierLedgerEntry,
    SupplierSpecialPrice,
)

ZERO = Decimal("0.00")


def get_supplier_balance(supplier) -> Decimal:
    """Recompute balance from the ledger (Σcredit − Σdebit)."""
    agg = supplier.ledger_entries.aggregate(d=Sum("debit"), c=Sum("credit"))
    return (agg["c"] or ZERO) - (agg["d"] or ZERO)


def _append_ledger(supplier, *, entry_type, debit=ZERO, credit=ZERO,
                   description="", entry_date=None, created_by=None, reason="",
                   reference_type="", reference_id="", reference_number=""):
    prev = supplier.current_balance or ZERO
    balance_after = prev + Decimal(credit) - Decimal(debit)
    entry = SupplierLedgerEntry.objects.create(
        company_id=supplier.company_id,
        supplier=supplier,
        entry_type=entry_type,
        debit=debit,
        credit=credit,
        balance_after=balance_after,
        description=description,
        entry_date=entry_date or timezone.now().date(),
        created_by=created_by,
        reason=reason,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else "",
        reference_number=reference_number,
    )
    supplier.current_balance = balance_after
    supplier.save(update_fields=["current_balance"])
    return entry


def _opening_debit_credit(amount: Decimal, ob_type: str):
    """Return (debit, credit) for an opening balance amount + type.

    we_owe_supplier  -> credit (increases payable)
    supplier_owes_us -> debit  (reduces payable / supplier credit to us)
    """
    amount = Decimal(amount or 0)
    if ob_type == OpeningBalanceType.WE_OWE_SUPPLIER:
        return ZERO, amount
    if ob_type == OpeningBalanceType.SUPPLIER_OWES_US:
        return amount, ZERO
    return ZERO, ZERO


@transaction.atomic
def create_supplier_with_opening_balance(*, company, created_by=None, **fields):
    opening_balance = Decimal(fields.get("opening_balance") or 0)
    ob_type = fields.get("opening_balance_type", OpeningBalanceType.ZERO)

    supplier = Supplier.objects.create(company=company, current_balance=ZERO, **fields)

    if ob_type != OpeningBalanceType.ZERO and opening_balance != ZERO:
        debit, credit = _opening_debit_credit(opening_balance, ob_type)
        _append_ledger(
            supplier,
            entry_type=SupplierLedgerEntry.EntryType.OPENING_BALANCE,
            debit=debit,
            credit=credit,
            description="Opening balance",
            created_by=created_by,
        )
    return supplier


@transaction.atomic
def update_supplier_opening_balance_with_reason(*, supplier, new_amount, new_type,
                                                reason, user=None):
    if not reason or not reason.strip():
        raise ValidationError({"reason": "Reason is required to edit opening balance."})

    old_debit, old_credit = _opening_debit_credit(
        supplier.opening_balance, supplier.opening_balance_type
    )
    new_debit, new_credit = _opening_debit_credit(new_amount, new_type)
    # Payable delta uses (credit − debit).
    delta = (new_credit - new_debit) - (old_credit - old_debit)

    supplier.opening_balance = Decimal(new_amount or 0)
    supplier.opening_balance_type = new_type
    supplier.save(update_fields=["opening_balance", "opening_balance_type"])

    if delta != ZERO:
        credit = delta if delta > 0 else ZERO
        debit = -delta if delta < 0 else ZERO
        _append_ledger(
            supplier,
            entry_type=SupplierLedgerEntry.EntryType.OPENING_BALANCE,
            debit=debit,
            credit=credit,
            description="Opening balance adjustment",
            created_by=user,
            reason=reason,
        )
    return supplier


@transaction.atomic
def record_purchase_invoice(*, supplier, amount, reference_id, reference_number,
                            created_by=None, reason="", entry_date=None,
                            description="Purchase invoice approved"):
    """Post a supplier payable (credit) for an approved purchase invoice.

    Credit increases ``current_balance`` (positive = we owe the supplier).
    """
    return _append_ledger(
        supplier,
        entry_type=SupplierLedgerEntry.EntryType.PURCHASE_INVOICE,
        credit=Decimal(amount or 0),
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="purchase_invoice",
        reference_id=reference_id,
        reference_number=reference_number,
    )


@transaction.atomic
def reverse_purchase_invoice(*, supplier, amount, reference_id, reference_number,
                             created_by=None, reason="", entry_date=None,
                             description="Purchase invoice cancelled"):
    """Reverse a previously posted purchase payable (debit), keeping history."""
    return _append_ledger(
        supplier,
        entry_type=SupplierLedgerEntry.EntryType.PURCHASE_CANCELLATION,
        debit=Decimal(amount or 0),
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="purchase_invoice",
        reference_id=reference_id,
        reference_number=reference_number,
    )


@transaction.atomic
def create_supplier_special_price(*, company, supplier, product, price, price_type,
                                  reason="", notes="", created_by=None,
                                  allow_override=False):
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    if supplier.company_id != company.id:
        raise ValidationError({"supplier": "Supplier does not belong to this company."})
    if not product.allow_supplier_special_price and not allow_override:
        raise ValidationError(
            {"product": "This product does not allow supplier special prices."}
        )
    if Decimal(price) < 0:
        raise ValidationError({"price": "Price cannot be negative."})

    SupplierSpecialPrice.objects.filter(
        company=company, supplier=supplier, product=product,
        price_type=price_type, is_active=True,
    ).update(is_active=False)

    return SupplierSpecialPrice.objects.create(
        company=company, supplier=supplier, product=product,
        price=price, price_type=price_type, reason=reason, notes=notes,
        created_by=created_by, updated_by=created_by, is_active=True,
    )


@transaction.atomic
def create_supplier_agreement(*, company, supplier, agreement_type, title,
                              description="", default_amount=None, percentage=None,
                              applies_automatically=False, suggestion_only=True,
                              notes="", created_by=None):
    if supplier.company_id != company.id:
        raise ValidationError({"supplier": "Supplier does not belong to this company."})
    if default_amount is not None and Decimal(default_amount) < 0:
        raise ValidationError({"default_amount": "Amount cannot be negative."})
    if percentage is not None and Decimal(percentage) < 0:
        raise ValidationError({"percentage": "Percentage cannot be negative."})

    return SupplierAgreement.objects.create(
        company=company, supplier=supplier, agreement_type=agreement_type,
        title=title, description=description, default_amount=default_amount,
        percentage=percentage, applies_automatically=applies_automatically,
        suggestion_only=suggestion_only, notes=notes,
        created_by=created_by, updated_by=created_by, is_active=True,
    )
