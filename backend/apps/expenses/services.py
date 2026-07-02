"""Expense business logic (Phase 8).

Operational expense totals exclude purchase-linked expenses whose behavior is
``reduce_supplier_payable`` or ``increase_inventory_cost`` — those flow through
the purchase adjustment workflow instead.
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.constants import risk_for_action
from apps.audit.services import create_audit_log, require_reason_for_sensitive_action
from apps.company_settings.constants import DocumentType
from apps.company_settings.services import generate_document_number
from apps.purchases.models import (
    PurchaseAdjustmentEffect,
    PurchaseAdjustmentType,
    PurchaseInvoice,
    PurchaseStatus,
)
from apps.purchases.services import (
    _create_adjustment,
    recalculate_purchase_invoice,
)
from apps.sales.models import SalesInvoice, SalesStatus

from . import calculations as calc
from .models import (
    Expense,
    ExpenseCategory,
    ExpenseScope,
    ExpenseStatus,
    ExpenseStatusHistory,
    PurchaseLinkBehavior,
    RecurrencePeriod,
    RecurringExpense,
)

ZERO = Decimal("0")


def _d(value) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(str(value))


def _check_category(company, category: ExpenseCategory) -> None:
    if category.company_id != company.id:
        raise ValidationError({"category": "Category must belong to the same company."})


def _check_purchase(company, invoice) -> PurchaseInvoice | None:
    if not invoice:
        return None
    invoice = PurchaseInvoice.objects.get(pk=invoice.pk)
    if invoice.company_id != company.id:
        raise ValidationError(
            {"linked_purchase_invoice": "Purchase invoice must belong to the same company."}
        )
    return invoice


def _validate_purchase_link(*, behavior, invoice, reason="") -> None:
    if behavior in (PurchaseLinkBehavior.NONE, PurchaseLinkBehavior.EXPENSE_ONLY):
        return
    if not invoice:
        raise ValidationError(
            {"linked_purchase_invoice": "Purchase invoice required for this link behavior."}
        )
    if invoice.status != PurchaseStatus.DRAFT:
        raise ValidationError(
            "Cannot reduce supplier payable or increase inventory cost for an approved "
            "purchase from the expenses module yet. Use purchase adjustment workflow."
        )
    if behavior in (
        PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
        PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
    ) and not reason:
        raise ValidationError({"reason": "Reason required for purchase-linked expense."})


def _operational_expense_filter() -> Q:
    """Posted expenses that count toward operational expense totals."""
    return Q(status=ExpenseStatus.POSTED) & ~Q(
        purchase_link_behavior__in=[
            PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
            PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
        ]
    )


def _compute_money(amount, vat_rate):
    amount = _d(amount)
    vat_rate = _d(vat_rate)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})
    if vat_rate < 0:
        raise ValidationError({"vat_rate": "VAT rate cannot be negative."})
    vat = calc.vat_amount(amount, vat_rate)
    total = calc.total_amount(amount, vat)
    return amount, vat_rate, vat, total


def _record_status_history(expense, from_status, to_status, reason, user):
    ExpenseStatusHistory.objects.create(
        company=expense.company,
        expense=expense,
        from_status=from_status or "",
        to_status=to_status,
        reason=reason or "",
        changed_by=user,
    )


def _advance_due_date(current: date, recurrence: str) -> date:
    if recurrence == RecurrencePeriod.WEEKLY:
        return current + timedelta(days=7)
    if recurrence == RecurrencePeriod.MONTHLY:
        month = current.month + 1
        year = current.year
        if month > 12:
            month = 1
            year += 1
        day = min(current.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)
    if recurrence == RecurrencePeriod.YEARLY:
        year = current.year + 1
        day = min(current.day, calendar.monthrange(year, current.month)[1])
        return date(year, current.month, day)
    return current


def _recurring_reference(recurring: RecurringExpense, target_date: date) -> str:
    return f"RECURRING-{recurring.id}-{target_date.isoformat()}"


def _apply_purchase_link(*, company, expense, invoice, behavior, user, reason):
    if behavior == PurchaseLinkBehavior.EXPENSE_ONLY:
        return None
    if behavior == PurchaseLinkBehavior.NONE:
        return None

    if behavior == PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE:
        adj_type = PurchaseAdjustmentType.SUPPLIER_DEDUCTION
        effect = PurchaseAdjustmentEffect.REDUCE_SUPPLIER_PAYABLE
    elif behavior == PurchaseLinkBehavior.INCREASE_INVENTORY_COST:
        adj_type = PurchaseAdjustmentType.ADD_TO_INVENTORY_COST
        effect = PurchaseAdjustmentEffect.INCREASE_INVENTORY_COST
    else:
        return None

    adjustment = _create_adjustment(
        company,
        invoice,
        {
            "adjustment_type": adj_type,
            "effect": effect,
            "title": expense.title,
            "amount": expense.amount,
            "vat_rate": expense.vat_rate,
            "notes": f"From expense {expense.expense_number}. {reason}".strip(),
        },
        created_by=user,
    )
    recalculate_purchase_invoice(invoice)
    return adjustment


@transaction.atomic
def create_expense(
    *,
    company,
    category,
    created_by,
    title,
    expense_date,
    amount,
    expense_scope=ExpenseScope.GENERAL,
    vat_rate=ZERO,
    payment_method="cash",
    description="",
    reference_number="",
    vendor_name="",
    employee_name="",
    vehicle_number="",
    linked_purchase_invoice=None,
    purchase_link_behavior=PurchaseLinkBehavior.NONE,
    notes="",
    reason="",
) -> Expense:
    _check_category(company, category)
    linked_purchase_invoice = _check_purchase(company, linked_purchase_invoice)
    _validate_purchase_link(
        behavior=purchase_link_behavior,
        invoice=linked_purchase_invoice,
        reason=reason,
    )

    amount, vat_rate, vat_amount, total_amount = _compute_money(amount, vat_rate)
    expense_number = generate_document_number(company, DocumentType.EXPENSE_VOUCHER)

    if linked_purchase_invoice and purchase_link_behavior == PurchaseLinkBehavior.NONE:
        purchase_link_behavior = PurchaseLinkBehavior.EXPENSE_ONLY
        expense_scope = ExpenseScope.PURCHASE_LINKED
    elif linked_purchase_invoice:
        expense_scope = ExpenseScope.PURCHASE_LINKED

    expense = Expense.objects.create(
        company=company,
        expense_number=expense_number,
        category=category,
        title=title,
        description=description,
        expense_date=expense_date,
        expense_scope=expense_scope,
        amount=amount,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total_amount=total_amount,
        payment_method=payment_method,
        reference_number=reference_number,
        vendor_name=vendor_name,
        employee_name=employee_name,
        vehicle_number=vehicle_number,
        linked_purchase_invoice=linked_purchase_invoice,
        purchase_link_behavior=purchase_link_behavior,
        notes=notes,
        created_by=created_by,
        updated_by=created_by,
    )

    if purchase_link_behavior in (
        PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
        PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
    ):
        adjustment = _apply_purchase_link(
            company=company,
            expense=expense,
            invoice=linked_purchase_invoice,
            behavior=purchase_link_behavior,
            user=created_by,
            reason=reason,
        )
        expense.related_purchase_adjustment = adjustment
        expense.save(update_fields=["related_purchase_adjustment", "updated_at"])

    _record_status_history(expense, "", ExpenseStatus.POSTED, "", created_by)

    audit_action = "create_expense"
    if purchase_link_behavior in (
        PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
        PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
    ):
        audit_action = "create_purchase_linked_expense"

    create_audit_log(
        action=audit_action,
        user=created_by,
        company=company,
        module="expenses",
        reference_type="expense",
        reference_id=expense.id,
        reason=reason or "",
        new_value={
            "expense_number": expense.expense_number,
            "amount": str(expense.total_amount),
            "purchase_link_behavior": purchase_link_behavior,
        },
        risk_level=risk_for_action("expense_cancel") if audit_action != "create_expense" else "low",
    )
    return expense


@transaction.atomic
def cancel_expense(*, expense, user, reason) -> Expense:
    reason = require_reason_for_sensitive_action("expense_cancel", reason)

    expense = Expense.objects.select_for_update().get(pk=expense.pk)
    if expense.status == ExpenseStatus.CANCELLED:
        raise ValidationError("Expense is already cancelled.")

    previous = {"status": expense.status, "total_amount": str(expense.total_amount)}

    if expense.related_purchase_adjustment_id:
        adj = expense.related_purchase_adjustment
        invoice = adj.invoice
        if invoice.status != PurchaseStatus.DRAFT:
            raise ValidationError(
                "Cannot cancel expense: linked purchase adjustment is on a non-draft invoice."
            )
        adj.delete()
        recalculate_purchase_invoice(invoice)
        expense.related_purchase_adjustment = None

    expense.status = ExpenseStatus.CANCELLED
    expense.cancellation_reason = reason
    expense.cancelled_by = user
    expense.cancelled_at = timezone.now()
    expense.updated_by = user
    expense.save(update_fields=[
        "status", "cancellation_reason", "cancelled_by", "cancelled_at",
        "related_purchase_adjustment", "updated_by", "updated_at",
    ])

    _record_status_history(expense, ExpenseStatus.POSTED, ExpenseStatus.CANCELLED, reason, user)
    create_audit_log(
        action="expense_cancel",
        user=user,
        company=expense.company,
        module="expenses",
        reference_type="expense",
        reference_id=expense.id,
        previous_value=previous,
        new_value={"status": expense.status},
        reason=reason,
    )
    return expense


@transaction.atomic
def create_recurring_expense(
    *,
    company,
    category,
    created_by,
    title,
    amount,
    recurrence,
    start_date,
    vat_rate=ZERO,
    payment_method="cash",
    description="",
    end_date=None,
    vendor_name="",
    notes="",
    auto_generate=False,
) -> RecurringExpense:
    _check_category(company, category)
    amount, vat_rate, vat_amount, total_amount = _compute_money(amount, vat_rate)

    recurring = RecurringExpense.objects.create(
        company=company,
        category=category,
        title=title,
        description=description,
        amount=amount,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total_amount=total_amount,
        recurrence=recurrence,
        start_date=start_date,
        end_date=end_date,
        next_due_date=start_date,
        payment_method=payment_method,
        vendor_name=vendor_name,
        notes=notes,
        is_active=True,
        auto_generate=auto_generate,
        created_by=created_by,
        updated_by=created_by,
    )
    create_audit_log(
        action="recurring_expense_create",
        user=created_by,
        company=company,
        module="expenses",
        reference_type="recurring_expense",
        reference_id=recurring.id,
        new_value={"title": recurring.title, "amount": str(recurring.total_amount)},
    )
    return recurring


@transaction.atomic
def generate_expense_from_recurring(
    *,
    recurring_expense,
    user,
    target_date=None,
) -> Expense:
    recurring = RecurringExpense.objects.select_for_update().get(pk=recurring_expense.pk)
    if not recurring.is_active:
        raise ValidationError("Inactive recurring expense cannot generate an expense.")

    target_date = target_date or recurring.next_due_date
    if recurring.end_date and target_date > recurring.end_date:
        raise ValidationError("Target date is after recurring expense end date.")
    if target_date < recurring.start_date:
        raise ValidationError("Target date is before recurring expense start date.")

    ref = _recurring_reference(recurring, target_date)
    if Expense.objects.filter(
        company=recurring.company,
        reference_number=ref,
        status=ExpenseStatus.POSTED,
    ).exists():
        raise ValidationError(
            "An expense was already generated for this recurring template on this date."
        )

    expense = create_expense(
        company=recurring.company,
        category=recurring.category,
        created_by=user,
        title=recurring.title,
        expense_date=target_date,
        amount=recurring.amount,
        expense_scope=ExpenseScope.RECURRING_GENERATED,
        vat_rate=recurring.vat_rate,
        payment_method=recurring.payment_method,
        description=recurring.description,
        reference_number=ref,
        vendor_name=recurring.vendor_name,
        notes=recurring.notes,
    )

    recurring.next_due_date = _advance_due_date(target_date, recurring.recurrence)
    recurring.updated_by = user
    recurring.save(update_fields=["next_due_date", "updated_by", "updated_at"])
    return expense


def get_expense_summary(company, *, date_from=None, date_to=None) -> dict:
    today = timezone.now().date()
    if isinstance(date_from, str) and date_from:
        date_from = date.fromisoformat(date_from)
    if isinstance(date_to, str) and date_to:
        date_to = date.fromisoformat(date_to)
    date_from = date_from or today.replace(day=1)
    date_to = date_to or today

    base = Expense.objects.filter(company=company, expense_date__gte=date_from, expense_date__lte=date_to)
    posted = base.filter(status=ExpenseStatus.POSTED)
    operational = posted.exclude(
        purchase_link_behavior__in=[
            PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
            PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
        ]
    )

    daily = operational.filter(
        expense_scope__in=[ExpenseScope.DAILY, ExpenseScope.GENERAL, ExpenseScope.PURCHASE_LINKED],
        expense_date=today,
    ).aggregate(total=Sum("total_amount"))["total"] or ZERO

    monthly = operational.filter(
        expense_scope__in=[
            ExpenseScope.MONTHLY,
            ExpenseScope.RECURRING_GENERATED,
            ExpenseScope.GENERAL,
            ExpenseScope.PURCHASE_LINKED,
            ExpenseScope.DAILY,
        ],
    ).aggregate(total=Sum("total_amount"))["total"] or ZERO

    purchase_linked = posted.filter(expense_scope=ExpenseScope.PURCHASE_LINKED).aggregate(
        total=Sum("total_amount")
    )["total"] or ZERO

    recurring_due = RecurringExpense.objects.filter(
        company=company, is_active=True, next_due_date__lte=today,
    ).count()

    cancelled_count = base.filter(status=ExpenseStatus.CANCELLED).count()
    total_expenses = operational.aggregate(total=Sum("total_amount"))["total"] or ZERO

    category_breakdown = list(
        operational.values("category__name_ar", "category__code")
        .annotate(total=Sum("total_amount"), count=Count("id"))
        .order_by("-total")
    )
    payment_breakdown = list(
        operational.values("payment_method")
        .annotate(total=Sum("total_amount"), count=Count("id"))
        .order_by("-total")
    )

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "total_expenses": total_expenses,
        "daily_expenses": daily,
        "monthly_expenses": monthly,
        "purchase_linked_expenses": purchase_linked,
        "recurring_due_count": recurring_due,
        "cancelled_expenses_count": cancelled_count,
        "category_breakdown": category_breakdown,
        "payment_method_breakdown": payment_breakdown,
    }


def get_profit_impact_foundation(company, *, date_from, date_to) -> dict:
    if isinstance(date_from, str):
        date_from = date.fromisoformat(date_from)
    if isinstance(date_to, str):
        date_to = date.fromisoformat(date_to)
    sales_qs = SalesInvoice.objects.filter(
        company=company,
        invoice_date__gte=date_from,
        invoice_date__lte=date_to,
        status__in=[
            SalesStatus.APPROVED,
            SalesStatus.PARTIALLY_PAID,
            SalesStatus.PAID,
        ],
    )
    from apps.purchases.models import PurchaseInvoice

    purchases_qs = PurchaseInvoice.objects.filter(
        company=company,
        invoice_date__gte=date_from,
        invoice_date__lte=date_to,
        status__in=[
            PurchaseStatus.APPROVED,
            PurchaseStatus.PARTIALLY_PAID,
            PurchaseStatus.PAID,
        ],
    )

    sales_total = sales_qs.aggregate(total=Sum("total_amount"))["total"] or ZERO
    purchases_total = purchases_qs.aggregate(total=Sum("total_amount"))["total"] or ZERO

    expenses_total = (
        Expense.objects.filter(
            company=company,
            expense_date__gte=date_from,
            expense_date__lte=date_to,
        )
        .filter(_operational_expense_filter())
        .aggregate(total=Sum("total_amount"))["total"]
        or ZERO
    )

    gross_profit_sum = sales_qs.aggregate(total=Sum("gross_profit"))["total"] or ZERO
    net_profit_foundation = sales_total - purchases_total - expenses_total
    fifo_gross_profit_foundation = gross_profit_sum - expenses_total

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "sales_total": sales_total,
        "purchases_total": purchases_total,
        "expenses_total": expenses_total,
        "gross_profit_if_available": gross_profit_sum,
        "net_profit_foundation": net_profit_foundation,
        "fifo_gross_profit_foundation": fifo_gross_profit_foundation,
        "notes": (
            "Foundation estimate only — not a final accounting report. "
            "Uses approved sales/purchases and posted operational expenses. "
            "Purchase-linked payable/cost adjustments are excluded from expenses_total."
        ),
    }


def build_expense_voucher_preview(expense) -> dict:
    company = expense.company
    category = expense.category
    return {
        "title_en": "EXPENSE VOUCHER",
        "title_ar": "سند مصروف",
        "company": {
            "name_ar": company.name_ar,
            "name_en": company.name_en,
            "trn": company.trn,
            "address": company.address,
            "phone": company.phone,
            "logo_url": company.logo.url if company.logo else None,
            "stamp_url": company.stamp.url if company.stamp else None,
            "signature_url": company.signature.url if company.signature else None,
        },
        "voucher": {
            "number": expense.expense_number,
            "date": str(expense.expense_date),
            "status": expense.status,
            "title": expense.title,
            "description": expense.description,
            "category": {
                "name_ar": category.name_ar,
                "name_en": category.name_en,
                "code": category.code,
            },
            "amount": str(expense.amount.quantize(Decimal("0.01"))),
            "vat_rate": str(expense.vat_rate.quantize(Decimal("0.01"))),
            "vat_amount": str(expense.vat_amount.quantize(Decimal("0.01"))),
            "total_amount": str(expense.total_amount.quantize(Decimal("0.01"))),
            "payment_method": expense.payment_method,
            "reference_number": expense.reference_number,
            "vendor_name": expense.vendor_name,
            "employee_name": expense.employee_name,
            "vehicle_number": expense.vehicle_number,
            "notes": expense.notes,
            "expense_scope": expense.expense_scope,
            "purchase_link_behavior": expense.purchase_link_behavior,
        },
        "prepared_by": expense.created_by.full_name if expense.created_by else "",
    }


def daily_expenses_total(company, target_date: date) -> Decimal:
    return (
        Expense.objects.filter(company=company, expense_date=target_date)
        .filter(_operational_expense_filter())
        .filter(
            expense_scope__in=[
                ExpenseScope.DAILY,
                ExpenseScope.GENERAL,
                ExpenseScope.PURCHASE_LINKED,
            ]
        )
        .aggregate(total=Sum("total_amount"))["total"]
        or ZERO
    )


def monthly_expenses_total(company, year: int, month: int) -> Decimal:
    last_day = calendar.monthrange(year, month)[1]
    start = date(year, month, 1)
    end = date(year, month, last_day)
    return (
        Expense.objects.filter(company=company, expense_date__gte=start, expense_date__lte=end)
        .filter(_operational_expense_filter())
        .filter(
            expense_scope__in=[
                ExpenseScope.MONTHLY,
                ExpenseScope.RECURRING_GENERATED,
                ExpenseScope.GENERAL,
                ExpenseScope.PURCHASE_LINKED,
                ExpenseScope.DAILY,
            ]
        )
        .aggregate(total=Sum("total_amount"))["total"]
        or ZERO
    )
