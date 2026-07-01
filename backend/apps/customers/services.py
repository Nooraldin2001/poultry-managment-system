"""Customer domain services (opening balance, ledger, special prices, credit).

Balance convention: current_balance = Σdebit − Σcredit (positive = customer owes
us). Sensitive-action auditing is performed by the views (which hold the request);
these services are request-agnostic so seed commands can reuse them.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    Customer,
    CustomerCreditLimitChange,
    CustomerFreeProductAgreement,
    CustomerLedgerEntry,
    CustomerSpecialPrice,
    OpeningBalanceType,
)

ZERO = Decimal("0.00")


def get_customer_balance(customer) -> Decimal:
    """Recompute balance from the ledger (source of truth)."""
    agg = customer.ledger_entries.aggregate(d=Sum("debit"), c=Sum("credit"))
    return (agg["d"] or ZERO) - (agg["c"] or ZERO)


def _append_ledger(customer, *, entry_type, debit=ZERO, credit=ZERO,
                   description="", entry_date=None, created_by=None, reason="",
                   reference_type="", reference_id="", reference_number=""):
    prev = customer.current_balance or ZERO
    balance_after = prev + Decimal(debit) - Decimal(credit)
    entry = CustomerLedgerEntry.objects.create(
        company_id=customer.company_id,
        customer=customer,
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
    customer.current_balance = balance_after
    customer.save(update_fields=["current_balance"])
    return entry


def _opening_debit_credit(amount: Decimal, ob_type: str):
    """Return (debit, credit) for an opening balance amount + type."""
    amount = Decimal(amount or 0)
    if ob_type == OpeningBalanceType.CUSTOMER_OWES_US:
        return amount, ZERO
    if ob_type == OpeningBalanceType.WE_OWE_CUSTOMER:
        return ZERO, amount
    return ZERO, ZERO


@transaction.atomic
def create_customer_with_opening_balance(*, company, created_by=None, **fields):
    opening_balance = Decimal(fields.get("opening_balance") or 0)
    ob_type = fields.get("opening_balance_type", OpeningBalanceType.ZERO)

    customer = Customer.objects.create(company=company, current_balance=ZERO, **fields)

    if ob_type != OpeningBalanceType.ZERO and opening_balance != ZERO:
        debit, credit = _opening_debit_credit(opening_balance, ob_type)
        _append_ledger(
            customer,
            entry_type=CustomerLedgerEntry.EntryType.OPENING_BALANCE,
            debit=debit,
            credit=credit,
            description="Opening balance",
            created_by=created_by,
        )
    return customer


@transaction.atomic
def update_customer_opening_balance_with_reason(*, customer, new_amount, new_type,
                                                reason, user=None):
    """Adjust opening balance after creation (sensitive). Records a correcting
    ledger entry for the delta so the running balance stays consistent.
    """
    if not reason or not reason.strip():
        raise ValidationError({"reason": "Reason is required to edit opening balance."})

    old_debit, old_credit = _opening_debit_credit(
        customer.opening_balance, customer.opening_balance_type
    )
    new_debit, new_credit = _opening_debit_credit(new_amount, new_type)
    delta = (new_debit - new_credit) - (old_debit - old_credit)

    customer.opening_balance = Decimal(new_amount or 0)
    customer.opening_balance_type = new_type
    customer.save(update_fields=["opening_balance", "opening_balance_type"])

    if delta != ZERO:
        debit = delta if delta > 0 else ZERO
        credit = -delta if delta < 0 else ZERO
        _append_ledger(
            customer,
            entry_type=CustomerLedgerEntry.EntryType.OPENING_BALANCE,
            debit=debit,
            credit=credit,
            description="Opening balance adjustment",
            created_by=user,
            reason=reason,
        )
    return customer


@transaction.atomic
def record_sales_invoice(*, customer, amount, reference_id, reference_number,
                         created_by=None, reason="", entry_date=None,
                         description="Sales invoice approved"):
    """Post customer receivable (debit) for an approved sales invoice.

    Debit increases ``current_balance`` (positive = customer owes us).
    Only the *unpaid* balance should be posted (``balance_due``).
    """
    amount = Decimal(amount or 0)
    if amount <= 0:
        return None
    return _append_ledger(
        customer,
        entry_type=CustomerLedgerEntry.EntryType.SALES_INVOICE,
        debit=amount,
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="sales_invoice",
        reference_id=reference_id,
        reference_number=reference_number,
    )


@transaction.atomic
def reverse_sales_invoice(*, customer, amount, reference_id, reference_number,
                          created_by=None, reason="", entry_date=None,
                          description="Sales invoice cancelled"):
    """Reverse a previously posted sales receivable (credit), keeping history."""
    amount = Decimal(amount or 0)
    if amount <= 0:
        return None
    return _append_ledger(
        customer,
        entry_type=CustomerLedgerEntry.EntryType.SALES_RETURN,
        credit=amount,
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="sales_invoice",
        reference_id=reference_id,
        reference_number=reference_number,
    )


@transaction.atomic
def record_collection_adjustment(*, customer, amount, reference_id, reference_number,
                                 created_by=None, reason="", entry_date=None,
                                 description="Collection adjustment"):
    """Reduce customer balance (credit) without changing invoice lines."""
    amount = Decimal(amount or 0)
    if amount <= 0:
        raise ValidationError({"amount": "Adjustment amount must be positive."})
    return _append_ledger(
        customer,
        entry_type=CustomerLedgerEntry.EntryType.COLLECTION_DISCOUNT,
        credit=amount,
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="sales_invoice",
        reference_id=reference_id,
        reference_number=reference_number,
    )


@transaction.atomic
def create_customer_special_price(*, company, customer, product, price, price_type,
                                  reason="", notes="", created_by=None,
                                  allow_override=False):
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    if customer.company_id != company.id:
        raise ValidationError({"customer": "Customer does not belong to this company."})
    if not product.allow_customer_special_price and not allow_override:
        raise ValidationError(
            {"product": "This product does not allow customer special prices."}
        )
    if Decimal(price) < 0:
        raise ValidationError({"price": "Price cannot be negative."})

    # Enforce single active price per (customer, product, price_type).
    CustomerSpecialPrice.objects.filter(
        company=company, customer=customer, product=product,
        price_type=price_type, is_active=True,
    ).update(is_active=False)

    return CustomerSpecialPrice.objects.create(
        company=company, customer=customer, product=product,
        price=price, price_type=price_type, reason=reason, notes=notes,
        created_by=created_by, updated_by=created_by, is_active=True,
    )


@transaction.atomic
def create_customer_free_product_agreement(*, company, customer, product,
                                           agreement_type, condition_amount=None,
                                           condition_quantity=None, notes="",
                                           created_by=None, allow_override=False):
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    if not product.allow_free_product and not allow_override:
        raise ValidationError({"product": "This product does not allow free agreements."})

    AT = CustomerFreeProductAgreement.AgreementType
    if agreement_type == AT.MINIMUM_INVOICE_AMOUNT and condition_amount is None:
        raise ValidationError({"condition_amount": "Required for minimum invoice amount."})
    if agreement_type == AT.MINIMUM_QUANTITY and condition_quantity is None:
        raise ValidationError({"condition_quantity": "Required for minimum quantity."})

    return CustomerFreeProductAgreement.objects.create(
        company=company, customer=customer, product=product,
        agreement_type=agreement_type, condition_amount=condition_amount,
        condition_quantity=condition_quantity, notes=notes,
        created_by=created_by, updated_by=created_by, is_active=True,
    )


@transaction.atomic
def change_customer_credit_limit(*, customer, new_limit, change_type, reason,
                                 changed_by=None, related_reference_type="",
                                 related_reference_id=""):
    """Record a credit-limit change (sensitive). Permanent changes update the
    customer; temporary-for-invoice changes are recorded only.
    """
    if not reason or not reason.strip():
        raise ValidationError({"reason": "Reason is required for credit limit changes."})
    new_limit = Decimal(new_limit)
    if new_limit < 0:
        raise ValidationError({"new_limit": "Credit limit cannot be negative."})

    previous = customer.credit_limit
    change = CustomerCreditLimitChange.objects.create(
        company_id=customer.company_id,
        customer=customer,
        previous_limit=previous,
        new_limit=new_limit,
        change_type=change_type,
        related_reference_type=related_reference_type,
        related_reference_id=str(related_reference_id) if related_reference_id else "",
        reason=reason,
        changed_by=changed_by,
    )
    if change_type == CustomerCreditLimitChange.ChangeType.PERMANENT:
        customer.credit_limit = new_limit
        customer.save(update_fields=["credit_limit"])
    return change


@transaction.atomic
def record_customer_collection(*, customer, amount, reference_id, reference_number,
                               created_by=None, reason="", entry_date=None,
                               description="Customer collection"):
    """Post a customer collection (credit). Reduces receivable balance."""
    amount = Decimal(amount or 0)
    if amount <= 0:
        raise ValidationError({"amount": "Collection amount must be positive."})
    return _append_ledger(
        customer,
        entry_type=CustomerLedgerEntry.EntryType.COLLECTION,
        credit=amount,
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="payment_movement",
        reference_id=reference_id,
        reference_number=reference_number,
    )


@transaction.atomic
def reverse_customer_collection(*, customer, amount, reference_id, reference_number,
                                created_by=None, reason="", entry_date=None,
                                description="Collection cancelled"):
    """Reverse a collection (debit), keeping history."""
    amount = Decimal(amount or 0)
    if amount <= 0:
        return None
    return _append_ledger(
        customer,
        entry_type=CustomerLedgerEntry.EntryType.MANUAL_ADJUSTMENT,
        debit=amount,
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="payment_movement",
        reference_id=reference_id,
        reference_number=reference_number,
    )


@transaction.atomic
def record_customer_refund(*, customer, amount, reference_id, reference_number,
                           created_by=None, reason="", entry_date=None,
                           description="Customer refund", allow_positive_balance=False):
    """Refund money to customer (debit). Normally reduces customer credit balance.

  If customer balance is positive (they owe us), refund increases what they owe
  unless ``allow_positive_balance`` is True (override).
    """
    amount = Decimal(amount or 0)
    if amount <= 0:
        raise ValidationError({"amount": "Refund amount must be positive."})
    if not reason or not reason.strip():
        raise ValidationError({"reason": "Reason is required for customer refund."})

    prev = customer.current_balance or ZERO
    if prev > ZERO and not allow_positive_balance:
        raise ValidationError(
            "Customer has a receivable balance; refund would increase amount owed."
        )
    if prev <= ZERO and (prev + amount) > ZERO and not allow_positive_balance:
        raise ValidationError(
            "Refund exceeds customer credit balance."
        )

    return _append_ledger(
        customer,
        entry_type=CustomerLedgerEntry.EntryType.CUSTOMER_REFUND,
        debit=amount,
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="payment_movement",
        reference_id=reference_id,
        reference_number=reference_number,
    )


@transaction.atomic
def reverse_customer_refund(*, customer, amount, reference_id, reference_number,
                            created_by=None, reason="", entry_date=None,
                            description="Customer refund cancelled"):
    amount = Decimal(amount or 0)
    if amount <= 0:
        return None
    return _append_ledger(
        customer,
        entry_type=CustomerLedgerEntry.EntryType.MANUAL_ADJUSTMENT,
        credit=amount,
        description=description,
        entry_date=entry_date,
        created_by=created_by,
        reason=reason,
        reference_type="payment_movement",
        reference_id=reference_id,
        reference_number=reference_number,
    )
