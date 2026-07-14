"""Payment domain services (Phase 6).

Balance conventions (documented):
* Customer: current_balance = Σdebit − Σcredit (positive = customer owes us).
  Collection = credit. Refund to customer = debit (reduces credit / increases receivable).
* Supplier: current_balance = Σcredit − Σdebit (positive = we owe supplier).
  Payment = debit. Refund from supplier = credit (reduces payable).
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import (
    create_audit_log,
    require_reason_for_sensitive_action,
)
from apps.company_settings.constants import DocumentType
from apps.company_settings.services import generate_document_number
from apps.customers import services as customer_services
from apps.customers.models import Customer
from apps.permissions.services import has_permission
from apps.tenants.print_identity import build_company_print_identity
from apps.purchases.models import PurchaseInvoice, PurchaseStatus
from apps.purchases.services import _apply_payment_state as _apply_purchase_payment_state
from apps.sales.models import SalesInvoice, SalesStatus
from apps.sales.services import _apply_payment_state as _apply_sales_payment_state
from apps.suppliers import services as supplier_services
from apps.suppliers.models import Supplier

from .models import (
    AllocationType,
    PartyType,
    PaymentAllocation,
    PaymentMethod,
    PaymentMovement,
    PaymentMovementStatus,
    PaymentMovementType,
    PaymentStatusHistory,
    MoneyAccount,
    MoneyAccountType,
    MoneyDirection,
    MoneyMovement,
    MoneyMovementType,
)

ZERO = Decimal("0")
MONEY_Q = Decimal("0.01")

_ALLOCATABLE_SALES = (
    SalesStatus.APPROVED, SalesStatus.PARTIALLY_PAID, SalesStatus.PAID
)
_ALLOCATABLE_PURCHASE = (
    PurchaseStatus.APPROVED, PurchaseStatus.PARTIALLY_PAID, PurchaseStatus.PAID
)

_RECEIPT_TITLES = {
    PaymentMovementType.CUSTOMER_COLLECTION: (
        "RECEIPT VOUCHER", "سند قبض"
    ),
    PaymentMovementType.SUPPLIER_PAYMENT: (
        "PAYMENT VOUCHER", "سند صرف"
    ),
    PaymentMovementType.CUSTOMER_REFUND: (
        "CUSTOMER REFUND", "رد مبلغ للعميل"
    ),
    PaymentMovementType.SUPPLIER_REFUND: (
        "SUPPLIER REFUND", "رد مبلغ من المورد"
    ),
}


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value if value is not None else 0))


def _account_balance_delta(direction: str, amount: Decimal) -> Decimal:
    return amount if direction == MoneyDirection.IN else -amount


@transaction.atomic
def post_money_movement(
    *,
    company,
    money_account,
    movement_type: str,
    direction: str,
    amount,
    reference_type="",
    reference_id="",
    description="",
    reason="",
    user=None,
    movement_date=None,
) -> MoneyMovement:
    amount = _d(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})
    if money_account.company_id != company.id:
        raise ValidationError({"money_account": "Account does not belong to this company."})
    account = MoneyAccount.objects.select_for_update().get(pk=money_account.pk)
    next_balance = _d(account.current_balance) + _account_balance_delta(direction, amount)
    if next_balance < 0 and not account.allow_negative:
        raise ValidationError({
            "detail": "Insufficient balance in the selected account.",
            "code": "insufficient_money_account_balance",
            "fields": {
                "money_account": [
                    "الرصيد المتاح غير كافٍ لإتمام الدفعة."
                ],
            },
        })
    account.current_balance = next_balance
    account.save(update_fields=["current_balance", "updated_at"])
    if movement_date is None:
        movement_date = timezone.now().date()
    return MoneyMovement.objects.create(
        company=company,
        money_account=account,
        movement_type=movement_type,
        direction=direction,
        amount=amount,
        reference_type=reference_type,
        reference_id=str(reference_id or ""),
        description=description or "",
        reason=reason or "",
        movement_date=movement_date,
        created_by=user,
    )


def get_treasury_summary(company) -> dict:
    from django.utils import timezone

    accounts = MoneyAccount.objects.filter(company=company, is_active=True)
    cash_qs = accounts.filter(account_type=MoneyAccountType.CASHBOX)
    bank_qs = accounts.filter(account_type=MoneyAccountType.BANK)
    cash_total = cash_qs.aggregate(s=Sum("current_balance"))["s"] or ZERO
    bank_total = bank_qs.aggregate(s=Sum("current_balance"))["s"] or ZERO

    today = timezone.localdate()
    today_movements = MoneyMovement.objects.filter(
        company=company,
        movement_date=today,
        money_account__is_active=True,
    )
    today_inflows = (
        today_movements.filter(direction=MoneyDirection.IN).aggregate(s=Sum("amount"))["s"] or ZERO
    )
    today_outflows = (
        today_movements.filter(direction=MoneyDirection.OUT).aggregate(s=Sum("amount"))["s"] or ZERO
    )

    return {
        "cashbox_total": cash_total,
        "bank_total": bank_total,
        "available_total": cash_total + bank_total,
        "accounts_count": accounts.count(),
        "active_cashboxes": cash_qs.count(),
        "active_banks": bank_qs.count(),
        "today_inflows": today_inflows,
        "today_outflows": today_outflows,
    }


def get_account_statement(
    company,
    account: MoneyAccount,
    *,
    date_from=None,
    date_to=None,
    movement_type: str = "",
    search: str = "",
) -> dict:
    """Opening/closing balances and filtered movements for an account statement."""
    qs = MoneyMovement.objects.filter(company=company, money_account=account)

    opening = _d(account.opening_balance)
    if date_from:
        prior = qs.filter(movement_date__lt=date_from).order_by("movement_date", "id")
        for movement in prior:
            opening += movement.amount if movement.direction == MoneyDirection.IN else -movement.amount

    filtered = qs
    if date_from:
        filtered = filtered.filter(movement_date__gte=date_from)
    if date_to:
        filtered = filtered.filter(movement_date__lte=date_to)
    if movement_type:
        filtered = filtered.filter(movement_type=movement_type)
    if search:
        filtered = filtered.filter(
            Q(description__icontains=search)
            | Q(reason__icontains=search)
            | Q(reference_id__icontains=search)
            | Q(reference_type__icontains=search)
        )

    movements = list(filtered.order_by("movement_date", "id"))
    closing = opening
    for movement in movements:
        closing += movement.amount if movement.direction == MoneyDirection.IN else -movement.amount

    return {
        "opening_balance": opening,
        "closing_balance": closing,
        "movements": movements,
    }


@transaction.atomic
def post_account_transfer(
    *,
    company,
    from_account: MoneyAccount,
    to_account: MoneyAccount,
    amount,
    reason: str,
    user,
    description: str = "",
) -> tuple[MoneyMovement, MoneyMovement]:
    """Transfer funds between two money accounts atomically."""
    reason = require_reason_for_sensitive_action("treasury_transfer", reason)
    amount = _d(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})
    if from_account.company_id != company.id or to_account.company_id != company.id:
        raise ValidationError("Accounts must belong to the same company.")
    if from_account.pk == to_account.pk:
        raise ValidationError({"to_account": "Source and destination must differ."})
    if not from_account.is_active or not to_account.is_active:
        raise ValidationError("Both accounts must be active for transfers.")

    from_account = MoneyAccount.objects.select_for_update().get(pk=from_account.pk)
    to_account = MoneyAccount.objects.select_for_update().get(pk=to_account.pk)

    if not from_account.allow_negative and _d(from_account.current_balance) < amount:
        raise ValidationError({
            "amount": (
                "Insufficient balance in source account / "
                "الرصيد غير كافٍ في الحساب المصدر"
            )
        })

    transfer_ref = f"{from_account.id}-{to_account.id}-{timezone.now().timestamp():.0f}"
    label = description or f"Transfer {from_account.name} → {to_account.name}"
    movement_date = timezone.localdate()

    out_movement = post_money_movement(
        company=company,
        money_account=from_account,
        movement_type=MoneyMovementType.ACCOUNT_TRANSFER,
        direction=MoneyDirection.OUT,
        amount=amount,
        reference_type="account_transfer",
        reference_id=transfer_ref,
        description=f"{label} (out)",
        reason=reason,
        user=user,
        movement_date=movement_date,
    )
    in_movement = post_money_movement(
        company=company,
        money_account=to_account,
        movement_type=MoneyMovementType.ACCOUNT_TRANSFER,
        direction=MoneyDirection.IN,
        amount=amount,
        reference_type="account_transfer",
        reference_id=transfer_ref,
        description=f"{label} (in)",
        reason=reason,
        user=user,
        movement_date=movement_date,
    )
    create_audit_log(
        action="treasury_transfer",
        user=user,
        company=company,
        module="treasury",
        reference_type="account_transfer",
        reference_id=transfer_ref,
        reason=reason,
        new_value={
            "from_account_id": from_account.id,
            "to_account_id": to_account.id,
            "amount": str(amount),
        },
    )
    return out_movement, in_movement


def _document_type_for_movement(movement_type: str) -> str:
    mapping = {
        PaymentMovementType.CUSTOMER_COLLECTION: DocumentType.CUSTOMER_RECEIPT,
        PaymentMovementType.SUPPLIER_PAYMENT: DocumentType.SUPPLIER_PAYMENT_RECEIPT,
        PaymentMovementType.CUSTOMER_REFUND: DocumentType.CUSTOMER_REFUND,
        PaymentMovementType.SUPPLIER_REFUND: DocumentType.SUPPLIER_REFUND,
        PaymentMovementType.COLLECTION_ADJUSTMENT: DocumentType.COLLECTION_ADJUSTMENT,
    }
    return mapping.get(movement_type, DocumentType.CUSTOMER_RECEIPT)


def _generate_numbers(company, movement_type: str) -> tuple[str, str]:
    doc_type = _document_type_for_movement(movement_type)
    receipt_number = generate_document_number(company, doc_type)
    return receipt_number, receipt_number


def _record_status_history(movement, from_status, to_status, reason, user):
    PaymentStatusHistory.objects.create(
        company_id=movement.company_id,
        movement=movement,
        from_status=from_status or "",
        to_status=to_status,
        reason=reason or "",
        changed_by=user,
    )


def _validate_allocations_total(amount, allocations):
    total = sum(_d(a.get("allocated_amount", a.get("amount", 0))) for a in allocations)
    if total > _d(amount):
        raise ValidationError("Total allocations cannot exceed movement amount.")


def _apply_sales_allocation(invoice, alloc_amount):
    invoice = SalesInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status not in _ALLOCATABLE_SALES:
        raise ValidationError(
            {"sales_invoice": "Cannot allocate to draft or cancelled sales invoice."}
        )
    alloc_amount = _d(alloc_amount)
    if alloc_amount > _d(invoice.balance_due):
        raise ValidationError(
            {"allocated_amount": "Allocation exceeds invoice balance due."}
        )
    invoice.amount_paid = _d(invoice.amount_paid) + alloc_amount
    _apply_sales_payment_state(invoice)
    invoice.save(update_fields=[
        "amount_paid", "balance_due", "payment_status", "status", "updated_at",
    ])
    return invoice


def _reverse_sales_allocation(invoice, alloc_amount):
    invoice = SalesInvoice.objects.select_for_update().get(pk=invoice.pk)
    alloc_amount = _d(alloc_amount)
    invoice.amount_paid = max(_d(invoice.amount_paid) - alloc_amount, ZERO)
    _apply_sales_payment_state(invoice)
    invoice.save(update_fields=[
        "amount_paid", "balance_due", "payment_status", "status", "updated_at",
    ])
    return invoice


def _apply_purchase_allocation(invoice, alloc_amount):
    invoice = PurchaseInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status not in _ALLOCATABLE_PURCHASE:
        raise ValidationError(
            {"purchase_invoice": "Cannot allocate to draft or cancelled purchase."}
        )
    alloc_amount = _d(alloc_amount)
    if alloc_amount > _d(invoice.balance_due):
        raise ValidationError(
            {"allocated_amount": "Allocation exceeds invoice balance due."}
        )
    invoice.amount_paid = _d(invoice.amount_paid) + alloc_amount
    _apply_purchase_payment_state(invoice)
    invoice.save(update_fields=[
        "amount_paid", "balance_due", "payment_status", "status", "updated_at",
    ])
    return invoice


def _reverse_purchase_allocation(invoice, alloc_amount):
    invoice = PurchaseInvoice.objects.select_for_update().get(pk=invoice.pk)
    alloc_amount = _d(alloc_amount)
    invoice.amount_paid = max(_d(invoice.amount_paid) - alloc_amount, ZERO)
    _apply_purchase_payment_state(invoice)
    invoice.save(update_fields=[
        "amount_paid", "balance_due", "payment_status", "status", "updated_at",
    ])
    return invoice


def _create_allocations(company, movement, allocation_payloads, *, party_customer=None,
                        party_supplier=None):
    rows = []
    for item in allocation_payloads:
        alloc_amount = _d(item["allocated_amount"])
        if alloc_amount <= 0:
            raise ValidationError({"allocated_amount": "Must be positive."})

        sales_invoice = item.get("sales_invoice")
        purchase_invoice = item.get("purchase_invoice")

        if sales_invoice:
            if sales_invoice.company_id != company.id:
                raise ValidationError({"sales_invoice": "Cross-tenant invoice."})
            if party_customer and sales_invoice.customer_id != party_customer.id:
                raise ValidationError({"sales_invoice": "Invoice customer mismatch."})
            _apply_sales_allocation(sales_invoice, alloc_amount)
            rows.append(PaymentAllocation.objects.create(
                company=company, movement=movement,
                allocation_type=AllocationType.SALES_INVOICE,
                sales_invoice=sales_invoice,
                allocated_amount=alloc_amount,
            ))
        elif purchase_invoice:
            if purchase_invoice.company_id != company.id:
                raise ValidationError({"purchase_invoice": "Cross-tenant invoice."})
            if party_supplier and purchase_invoice.supplier_id != party_supplier.id:
                raise ValidationError({"purchase_invoice": "Invoice supplier mismatch."})
            _apply_purchase_allocation(purchase_invoice, alloc_amount)
            rows.append(PaymentAllocation.objects.create(
                company=company, movement=movement,
                allocation_type=AllocationType.PURCHASE_INVOICE,
                purchase_invoice=purchase_invoice,
                allocated_amount=alloc_amount,
            ))
        else:
            rows.append(PaymentAllocation.objects.create(
                company=company, movement=movement,
                allocation_type=AllocationType.ACCOUNT_LEVEL,
                allocated_amount=alloc_amount,
            ))
    return rows


# ── Customer collection ─────────────────────────────────────────────────────
def _post_party_treasury_movement(
    *,
    company,
    money_account,
    payment_method,
    amount,
    movement_type,
    direction,
    reference_type,
    reference_id,
    description,
    reason,
    user,
    movement_date,
):
    from apps.payments.treasury_integration import validate_money_account_for_flow

    validate_money_account_for_flow(
        payment_method=payment_method,
        money_account=money_account,
        amount=amount,
    )
    if not money_account:
        return None
    return post_money_movement(
        company=company,
        money_account=money_account,
        movement_type=movement_type,
        direction=direction,
        amount=amount,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
        reason=reason,
        user=user,
        movement_date=movement_date,
    )


def _reverse_treasury_movements_for_payment(*, company, movement, user, reason) -> None:
    """Reverse treasury effects posted for a payment movement cancellation."""
    original_qs = MoneyMovement.objects.select_for_update().filter(
        company=company,
        reference_type="payment_movement",
        reference_id=str(movement.id),
    )
    if not original_qs.exists():
        return

    already_reversed = MoneyMovement.objects.filter(
        company=company,
        reference_type="payment_movement_cancel",
        reference_id=str(movement.id),
    ).exists()
    if already_reversed:
        raise ValidationError("Treasury movement has already been reversed.")

    for original in original_qs:
        reverse_direction = (
            MoneyDirection.OUT
            if original.direction == MoneyDirection.IN
            else MoneyDirection.IN
        )
        post_money_movement(
            company=company,
            money_account=original.money_account,
            movement_type=original.movement_type,
            direction=reverse_direction,
            amount=original.amount,
            reference_type="payment_movement_cancel",
            reference_id=movement.id,
            description=f"Cancel {movement.receipt_number or movement.movement_number}",
            reason=reason,
            user=user,
            movement_date=timezone.now().date(),
        )


@transaction.atomic
def record_customer_collection(
    *, company, customer, amount, payment_method, allocations=None,
    reference_number="", bank_name="", cheque_number="", cheque_date=None,
    movement_date=None, notes="", user, reason="", money_account=None,
):
    amount = _d(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})
    if customer.company_id != company.id:
        raise ValidationError({"customer": "Customer does not belong to this company."})

    allocations = allocations or []
    _validate_allocations_total(amount, allocations)

    customer = Customer.objects.select_for_update().get(pk=customer.pk)
    movement_number, receipt_number = _generate_numbers(
        company, PaymentMovementType.CUSTOMER_COLLECTION
    )

    movement = PaymentMovement.objects.create(
        company=company,
        movement_number=movement_number,
        receipt_number=receipt_number,
        movement_type=PaymentMovementType.CUSTOMER_COLLECTION,
        party_type=PartyType.CUSTOMER,
        customer=customer,
        movement_date=movement_date or timezone.now().date(),
        payment_method=payment_method,
        amount=amount,
        reference_number=reference_number or "",
        bank_name=bank_name or "",
        cheque_number=cheque_number or "",
        cheque_date=cheque_date,
        notes=notes or "",
        status=PaymentMovementStatus.POSTED,
        posted_by=user,
    )

    _create_allocations(
        company, movement, allocations, party_customer=customer,
    )

    customer_services.record_customer_collection(
        customer=customer,
        amount=amount,
        reference_id=movement.id,
        reference_number=receipt_number,
        created_by=user,
        reason=reason,
        entry_date=movement.movement_date,
    )

    _post_party_treasury_movement(
        company=company,
        money_account=money_account,
        payment_method=payment_method,
        amount=amount,
        movement_type=MoneyMovementType.CUSTOMER_COLLECTION,
        direction=MoneyDirection.IN,
        reference_type="payment_movement",
        reference_id=movement.id,
        description=f"Customer collection {receipt_number}",
        reason=reason,
        user=user,
        movement_date=movement.movement_date,
    )

    create_audit_log(
        action="customer_collection",
        user=user, company=company, module="payments",
        reference_type="payment_movement", reference_id=movement.id,
        reason=reason or "",
        new_value={"amount": str(amount), "receipt_number": receipt_number},
    )
    return movement


# ── Supplier payment ────────────────────────────────────────────────────────
@transaction.atomic
def record_supplier_payment(
    *, company, supplier, amount, payment_method, allocations=None,
    reference_number="", bank_name="", cheque_number="", cheque_date=None,
    movement_date=None, notes="", user, reason="", money_account=None,
):
    amount = _d(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})
    if supplier.company_id != company.id:
        raise ValidationError({"supplier": "Supplier does not belong to this company."})

    allocations = allocations or []
    _validate_allocations_total(amount, allocations)

    supplier = Supplier.objects.select_for_update().get(pk=supplier.pk)
    movement_number, receipt_number = _generate_numbers(
        company, PaymentMovementType.SUPPLIER_PAYMENT
    )

    movement = PaymentMovement.objects.create(
        company=company,
        movement_number=movement_number,
        receipt_number=receipt_number,
        movement_type=PaymentMovementType.SUPPLIER_PAYMENT,
        party_type=PartyType.SUPPLIER,
        supplier=supplier,
        movement_date=movement_date or timezone.now().date(),
        payment_method=payment_method,
        amount=amount,
        reference_number=reference_number or "",
        bank_name=bank_name or "",
        cheque_number=cheque_number or "",
        cheque_date=cheque_date,
        notes=notes or "",
        status=PaymentMovementStatus.POSTED,
        posted_by=user,
    )

    _create_allocations(
        company, movement, allocations, party_supplier=supplier,
    )

    supplier_services.record_supplier_payment(
        supplier=supplier,
        amount=amount,
        reference_id=movement.id,
        reference_number=receipt_number,
        created_by=user,
        reason=reason,
        entry_date=movement.movement_date,
    )

    _post_party_treasury_movement(
        company=company,
        money_account=money_account,
        payment_method=payment_method,
        amount=amount,
        movement_type=MoneyMovementType.SUPPLIER_PAYMENT,
        direction=MoneyDirection.OUT,
        reference_type="payment_movement",
        reference_id=movement.id,
        description=f"Supplier payment {receipt_number}",
        reason=reason,
        user=user,
        movement_date=movement.movement_date,
    )

    create_audit_log(
        action="supplier_payment",
        user=user, company=company, module="payments",
        reference_type="payment_movement", reference_id=movement.id,
        reason=reason or "",
        new_value={"amount": str(amount), "receipt_number": receipt_number},
    )
    return movement


# ── Refunds ─────────────────────────────────────────────────────────────────
@transaction.atomic
def record_customer_refund(
    *, company, customer, amount, payment_method, reference_number="",
    bank_name="", cheque_number="", cheque_date=None, movement_date=None,
    notes="", user, reason, allow_override=False, money_account=None,
):
    reason = require_reason_for_sensitive_action("customer_refund", reason)
    amount = _d(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})
    if customer.company_id != company.id:
        raise ValidationError({"customer": "Customer does not belong to this company."})
    if allow_override and not has_permission(user, "payments.sensitive"):
        raise ValidationError("Missing permission for refund override.")

    customer = Customer.objects.select_for_update().get(pk=customer.pk)
    movement_number, receipt_number = _generate_numbers(
        company, PaymentMovementType.CUSTOMER_REFUND
    )

    movement = PaymentMovement.objects.create(
        company=company,
        movement_number=movement_number,
        receipt_number=receipt_number,
        movement_type=PaymentMovementType.CUSTOMER_REFUND,
        party_type=PartyType.CUSTOMER,
        customer=customer,
        movement_date=movement_date or timezone.now().date(),
        payment_method=payment_method,
        amount=amount,
        reference_number=reference_number or "",
        bank_name=bank_name or "",
        cheque_number=cheque_number or "",
        cheque_date=cheque_date,
        notes=notes or "",
        status=PaymentMovementStatus.POSTED,
        posted_by=user,
    )

    customer_services.record_customer_refund(
        customer=customer,
        amount=amount,
        reference_id=movement.id,
        reference_number=receipt_number,
        created_by=user,
        reason=reason,
        entry_date=movement.movement_date,
        allow_positive_balance=allow_override,
    )

    _post_party_treasury_movement(
        company=company,
        money_account=money_account,
        payment_method=payment_method,
        amount=amount,
        movement_type=MoneyMovementType.REFUND,
        direction=MoneyDirection.OUT,
        reference_type="payment_movement",
        reference_id=movement.id,
        description=f"Customer refund {receipt_number}",
        reason=reason,
        user=user,
        movement_date=movement.movement_date,
    )

    create_audit_log(
        action="customer_refund",
        user=user, company=company, module="payments",
        reference_type="payment_movement", reference_id=movement.id,
        reason=reason,
        new_value={"amount": str(amount), "receipt_number": receipt_number},
    )
    return movement


@transaction.atomic
def record_supplier_refund(
    *, company, supplier, amount, payment_method, reference_number="",
    bank_name="", cheque_number="", cheque_date=None, movement_date=None,
    notes="", user, reason, allow_override=False, money_account=None,
):
    reason = require_reason_for_sensitive_action("supplier_refund", reason)
    amount = _d(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})
    if supplier.company_id != company.id:
        raise ValidationError({"supplier": "Supplier does not belong to this company."})
    if allow_override and not has_permission(user, "payments.sensitive"):
        raise ValidationError("Missing permission for refund override.")

    supplier = Supplier.objects.select_for_update().get(pk=supplier.pk)
    movement_number, receipt_number = _generate_numbers(
        company, PaymentMovementType.SUPPLIER_REFUND
    )

    movement = PaymentMovement.objects.create(
        company=company,
        movement_number=movement_number,
        receipt_number=receipt_number,
        movement_type=PaymentMovementType.SUPPLIER_REFUND,
        party_type=PartyType.SUPPLIER,
        supplier=supplier,
        movement_date=movement_date or timezone.now().date(),
        payment_method=payment_method,
        amount=amount,
        reference_number=reference_number or "",
        bank_name=bank_name or "",
        cheque_number=cheque_number or "",
        cheque_date=cheque_date,
        notes=notes or "",
        status=PaymentMovementStatus.POSTED,
        posted_by=user,
    )

    supplier_services.record_supplier_refund(
        supplier=supplier,
        amount=amount,
        reference_id=movement.id,
        reference_number=receipt_number,
        created_by=user,
        reason=reason,
        entry_date=movement.movement_date,
        allow_negative_balance=allow_override,
    )

    _post_party_treasury_movement(
        company=company,
        money_account=money_account,
        payment_method=payment_method,
        amount=amount,
        movement_type=MoneyMovementType.REFUND,
        direction=MoneyDirection.IN,
        reference_type="payment_movement",
        reference_id=movement.id,
        description=f"Supplier refund {receipt_number}",
        reason=reason,
        user=user,
        movement_date=movement.movement_date,
    )

    create_audit_log(
        action="supplier_refund",
        user=user, company=company, module="payments",
        reference_type="payment_movement", reference_id=movement.id,
        reason=reason,
        new_value={"amount": str(amount), "receipt_number": receipt_number},
    )
    return movement


# ── Cancellation ────────────────────────────────────────────────────────────
@transaction.atomic
def cancel_payment_movement(*, movement, user, reason) -> PaymentMovement:
    reason = require_reason_for_sensitive_action("payment_cancel", reason)

    movement = (
        PaymentMovement.objects.select_for_update()
        .prefetch_related("allocations")
        .get(pk=movement.pk)
    )
    if movement.status == PaymentMovementStatus.CANCELLED:
        raise ValidationError("Payment movement is already cancelled.")

    company = movement.company
    from_status = movement.status

    for alloc in movement.allocations.all():
        if alloc.sales_invoice_id:
            _reverse_sales_allocation(alloc.sales_invoice, alloc.allocated_amount)
        elif alloc.purchase_invoice_id:
            _reverse_purchase_allocation(alloc.purchase_invoice, alloc.allocated_amount)

    if movement.movement_type == PaymentMovementType.CUSTOMER_COLLECTION:
        customer = Customer.objects.select_for_update().get(pk=movement.customer_id)
        customer_services.reverse_customer_collection(
            customer=customer,
            amount=movement.amount,
            reference_id=movement.id,
            reference_number=movement.receipt_number,
            created_by=user,
            reason=reason,
            entry_date=timezone.now().date(),
        )
    elif movement.movement_type == PaymentMovementType.SUPPLIER_PAYMENT:
        supplier = Supplier.objects.select_for_update().get(pk=movement.supplier_id)
        supplier_services.reverse_supplier_payment(
            supplier=supplier,
            amount=movement.amount,
            reference_id=movement.id,
            reference_number=movement.receipt_number,
            created_by=user,
            reason=reason,
            entry_date=timezone.now().date(),
        )
    elif movement.movement_type == PaymentMovementType.CUSTOMER_REFUND:
        customer = Customer.objects.select_for_update().get(pk=movement.customer_id)
        customer_services.reverse_customer_refund(
            customer=customer,
            amount=movement.amount,
            reference_id=movement.id,
            reference_number=movement.receipt_number,
            created_by=user,
            reason=reason,
            entry_date=timezone.now().date(),
        )
    elif movement.movement_type == PaymentMovementType.SUPPLIER_REFUND:
        supplier = Supplier.objects.select_for_update().get(pk=movement.supplier_id)
        supplier_services.reverse_supplier_refund(
            supplier=supplier,
            amount=movement.amount,
            reference_id=movement.id,
            reference_number=movement.receipt_number,
            created_by=user,
            reason=reason,
            entry_date=timezone.now().date(),
        )
    else:
        raise ValidationError("This movement type cannot be cancelled via API.")

    _reverse_treasury_movements_for_payment(
        company=company,
        movement=movement,
        user=user,
        reason=reason,
    )

    movement.status = PaymentMovementStatus.CANCELLED
    movement.cancel_reason = reason
    movement.cancelled_by = user
    movement.cancelled_at = timezone.now()
    movement.save(update_fields=[
        "status", "cancel_reason", "cancelled_by", "cancelled_at", "updated_at",
    ])
    _record_status_history(movement, from_status, PaymentMovementStatus.CANCELLED, reason, user)

    create_audit_log(
        action="payment_cancel",
        user=user, company=company, module="payments",
        reference_type="payment_movement", reference_id=movement.id,
        reason=reason,
        previous_value={"status": from_status},
        new_value={"status": PaymentMovementStatus.CANCELLED},
    )
    return movement


# ── Print preview ───────────────────────────────────────────────────────────
def build_receipt_preview(movement, request=None) -> dict:
    company = movement.company
    titles = _RECEIPT_TITLES.get(
        movement.movement_type, ("PAYMENT RECEIPT", "إيصال")
    )
    allocations = []
    for alloc in movement.allocations.select_related(
        "sales_invoice", "purchase_invoice"
    ).all():
        if alloc.sales_invoice_id:
            allocations.append({
                "type": "sales_invoice",
                "invoice_number": alloc.sales_invoice.invoice_number,
                "amount": str(alloc.allocated_amount),
            })
        elif alloc.purchase_invoice_id:
            allocations.append({
                "type": "purchase_invoice",
                "invoice_number": alloc.purchase_invoice.invoice_number,
                "amount": str(alloc.allocated_amount),
            })
        else:
            allocations.append({
                "type": "account_level",
                "amount": str(alloc.allocated_amount),
            })

    party = {}
    if movement.customer_id:
        party = {
            "type": "customer",
            "name": movement.customer.name_ar,
            "phone": movement.customer.phone,
            "trn": movement.customer.trn,
        }
    elif movement.supplier_id:
        party = {
            "type": "supplier",
            "name": movement.supplier.name_ar,
            "phone": movement.supplier.phone,
            "trn": movement.supplier.trn,
        }

    return {
        "title_en": titles[0],
        "title_ar": titles[1],
        "company": build_company_print_identity(company, request),
        "party": party,
        "receipt_number": movement.receipt_number or movement.movement_number,
        "movement_number": movement.movement_number,
        "movement_date": str(movement.movement_date),
        "movement_type": movement.movement_type,
        "party": party,
        "amount": str(_d(movement.amount).quantize(MONEY_Q)),
        "payment_method": movement.payment_method,
        "reference_number": movement.reference_number,
        "bank_name": movement.bank_name,
        "cheque_number": movement.cheque_number,
        "cheque_date": str(movement.cheque_date) if movement.cheque_date else None,
        "allocations": allocations,
        "notes": movement.notes,
        "prepared_by": movement.posted_by.full_name if movement.posted_by else "",
        "status": movement.status,
    }


# ── Summary & reconciliation ──────────────────────────────────────────────────
def get_payment_summary(company) -> dict:
    today = timezone.now().date()
    month_start = today.replace(day=1)
    posted = PaymentMovement.objects.filter(
        company=company, status=PaymentMovementStatus.POSTED,
        movement_date__gte=month_start,
    )
    collections = posted.filter(
        movement_type=PaymentMovementType.CUSTOMER_COLLECTION
    ).aggregate(s=Sum("amount"))["s"] or ZERO
    supplier_pays = posted.filter(
        movement_type=PaymentMovementType.SUPPLIER_PAYMENT
    ).aggregate(s=Sum("amount"))["s"] or ZERO
    cust_refunds = posted.filter(
        movement_type=PaymentMovementType.CUSTOMER_REFUND
    ).aggregate(s=Sum("amount"))["s"] or ZERO
    sup_refunds = posted.filter(
        movement_type=PaymentMovementType.SUPPLIER_REFUND
    ).aggregate(s=Sum("amount"))["s"] or ZERO

    method_breakdown = {}
    for row in posted.values("payment_method").annotate(total=Sum("amount")):
        method_breakdown[row["payment_method"]] = str(row["total"] or ZERO)

    unpaid_sales = SalesInvoice.objects.filter(
        company=company, balance_due__gt=0,
    ).exclude(status=SalesStatus.CANCELLED).aggregate(s=Sum("balance_due"))["s"] or ZERO
    unpaid_purchases = PurchaseInvoice.objects.filter(
        company=company, balance_due__gt=0,
    ).exclude(status=PurchaseStatus.CANCELLED).aggregate(s=Sum("balance_due"))["s"] or ZERO

    return {
        "total_customer_collections_this_month": collections,
        "total_supplier_payments_this_month": supplier_pays,
        "total_customer_refunds_this_month": cust_refunds,
        "total_supplier_refunds_this_month": sup_refunds,
        "net_cash_movement": (collections + sup_refunds) - (supplier_pays + cust_refunds),
        "unpaid_sales_balance": unpaid_sales,
        "unpaid_purchase_balance": unpaid_purchases,
        "cancelled_movements_count": PaymentMovement.objects.filter(
            company=company, status=PaymentMovementStatus.CANCELLED,
            movement_date__gte=month_start,
        ).count(),
        "payment_method_breakdown": method_breakdown,
    }


def reconcile_customer_balance(company, customer) -> dict:
    if customer.company_id != company.id:
        raise ValidationError({"customer": "Customer does not belong to this company."})
    customer = Customer.objects.get(pk=customer.pk)
    ledger_balance = customer_services.get_customer_balance(customer)
    cached = _d(customer.current_balance)
    open_invoices = SalesInvoice.objects.filter(
        company=company, customer=customer,
        status__in=_ALLOCATABLE_SALES, balance_due__gt=0,
    ).aggregate(s=Sum("balance_due"))["s"] or ZERO
    diff = cached - ledger_balance
    matched = abs(diff) < MONEY_Q
    return {
        "current_balance": cached,
        "ledger_balance": ledger_balance,
        "open_sales_invoice_balance": open_invoices,
        "difference": diff,
        "status": "matched" if matched else "mismatch",
    }


def reconcile_supplier_balance(company, supplier) -> dict:
    if supplier.company_id != company.id:
        raise ValidationError({"supplier": "Supplier does not belong to this company."})
    supplier = Supplier.objects.get(pk=supplier.pk)
    ledger_balance = supplier_services.get_supplier_balance(supplier)
    cached = _d(supplier.current_balance)
    open_invoices = PurchaseInvoice.objects.filter(
        company=company, supplier=supplier,
        status__in=_ALLOCATABLE_PURCHASE, balance_due__gt=0,
    ).aggregate(s=Sum("balance_due"))["s"] or ZERO
    diff = cached - ledger_balance
    matched = abs(diff) < MONEY_Q
    return {
        "current_balance": cached,
        "ledger_balance": ledger_balance,
        "open_purchase_invoice_balance": open_invoices,
        "difference": diff,
        "status": "matched" if matched else "mismatch",
    }


def get_customer_collections(company, customer):
    if customer.company_id != company.id:
        raise ValidationError({"customer": "Customer does not belong to this company."})
    return PaymentMovement.objects.filter(
        company=company, customer=customer,
        movement_type=PaymentMovementType.CUSTOMER_COLLECTION,
    ).order_by("-movement_date", "-id")


def get_supplier_payments(company, supplier):
    if supplier.company_id != company.id:
        raise ValidationError({"supplier": "Supplier does not belong to this company."})
    return PaymentMovement.objects.filter(
        company=company, supplier=supplier,
        movement_type=PaymentMovementType.SUPPLIER_PAYMENT,
    ).order_by("-movement_date", "-id")
