"""Tax / VAT business logic (Phase 9).

Internal estimate only — not an official UAE tax filing engine.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.constants import risk_for_action
from apps.audit.models import AuditLog
from apps.audit.services import create_audit_log, require_reason_for_sensitive_action
from apps.company_settings.constants import DocumentType
from apps.company_settings.models import PrintTemplateSettings, VATSettings
from apps.company_settings.services import generate_document_number
from apps.expenses.models import Expense, ExpenseStatus, PurchaseLinkBehavior
from apps.purchases.models import PurchaseInvoice, PurchaseStatus
from apps.sales.models import SalesInvoice, SalesStatus

from .models import (
    TaxAdjustment,
    TaxAdjustmentStatus,
    TaxAdjustmentType,
    TaxPeriod,
    TaxPeriodStatus,
    TaxSourceType,
    TaxWarning,
    TaxWarningSeverity,
    TaxWarningStatus,
    TaxWarningType,
)

ZERO = Decimal("0")
VAT_TOLERANCE = Decimal("0.01")

SALES_VAT_STATUSES = [
    SalesStatus.APPROVED,
    SalesStatus.PARTIALLY_PAID,
    SalesStatus.PAID,
]
PURCHASE_VAT_STATUSES = [
    PurchaseStatus.APPROVED,
    PurchaseStatus.PARTIALLY_PAID,
    PurchaseStatus.PAID,
]


def _d(value) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(str(value))


def _parse_dates(date_from, date_to):
    if isinstance(date_from, str):
        date_from = date.fromisoformat(date_from)
    if isinstance(date_to, str):
        date_to = date.fromisoformat(date_to)
    if date_from > date_to:
        raise ValidationError({"date_to": "date_to must be on or after date_from."})
    return date_from, date_to


def _vat_settings(company) -> VATSettings:
    return VATSettings.objects.get(company=company)


def _expected_vat(taxable_amount, vat_rate) -> Decimal:
    taxable = _d(taxable_amount)
    rate = _d(vat_rate)
    if not taxable or not rate:
        return ZERO
    return (taxable * rate / Decimal("100")).quantize(Decimal("0.01"))


def _is_vat_disabled_doc(taxable_amount, vat_rate, vat_amount, vat_enabled_default=True) -> bool:
    taxable = _d(taxable_amount)
    if taxable <= 0:
        return False
    if not vat_enabled_default:
        return False
    return _d(vat_rate) == ZERO or _d(vat_amount) == ZERO


def _sales_vat_qs(company, date_from, date_to):
    return SalesInvoice.objects.filter(
        company=company,
        invoice_date__gte=date_from,
        invoice_date__lte=date_to,
        status__in=SALES_VAT_STATUSES,
    ).select_related("customer")


def _purchase_vat_qs(company, date_from, date_to):
    return PurchaseInvoice.objects.filter(
        company=company,
        invoice_date__gte=date_from,
        invoice_date__lte=date_to,
        status__in=PURCHASE_VAT_STATUSES,
    ).select_related("supplier")


def _expense_vat_qs(company, date_from, date_to):
    return Expense.objects.filter(
        company=company,
        expense_date__gte=date_from,
        expense_date__lte=date_to,
        status=ExpenseStatus.POSTED,
    ).exclude(
        purchase_link_behavior__in=[
            PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
            PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
        ],
    ).select_related("category")


def _sales_record(inv) -> dict:
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_date": str(inv.invoice_date),
        "customer_id": inv.customer_id,
        "customer_name": inv.customer_name_snapshot,
        "customer_trn": inv.customer_trn_snapshot,
        "subtotal": str(inv.subtotal),
        "taxable_amount": str(inv.taxable_amount),
        "vat_rate": str(inv.vat_rate),
        "vat_amount": str(inv.vat_amount),
        "total_amount": str(inv.total_amount),
        "status": inv.status,
        "payment_status": inv.payment_status,
        "vat_disabled": not inv.vat_enabled,
        "missing_customer_trn": (
            _d(inv.taxable_amount) > 0 and not (inv.customer_trn_snapshot or "").strip()
        ),
    }


def _purchase_record(inv) -> dict:
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "supplier_invoice_number": inv.supplier_invoice_number,
        "invoice_date": str(inv.invoice_date),
        "supplier_id": inv.supplier_id,
        "supplier_name": inv.supplier_name_snapshot,
        "supplier_trn": inv.supplier_trn_snapshot,
        "subtotal": str(inv.subtotal),
        "taxable_amount": str(inv.taxable_amount),
        "vat_rate": str(inv.vat_rate),
        "vat_amount": str(inv.vat_amount),
        "total_amount": str(inv.total_amount),
        "status": inv.status,
        "payment_status": inv.payment_status,
        "vat_disabled": not inv.vat_enabled,
        "missing_supplier_trn": (
            _d(inv.vat_amount) > 0 and not (inv.supplier_trn_snapshot or "").strip()
        ),
    }


def _expense_record(exp) -> dict:
    return {
        "id": exp.id,
        "expense_number": exp.expense_number,
        "expense_date": str(exp.expense_date),
        "category": exp.category.name_ar,
        "amount": str(exp.amount),
        "taxable_amount": str(exp.amount),
        "vat_rate": str(exp.vat_rate),
        "vat_amount": str(exp.vat_amount),
        "total_amount": str(exp.total_amount),
        "payment_method": exp.payment_method,
        "linked_purchase_invoice": exp.linked_purchase_invoice_id,
        "purchase_link_behavior": exp.purchase_link_behavior,
        "vat_disabled": _d(exp.vat_rate) == ZERO and _d(exp.amount) > 0,
    }


def get_sales_vat_report(company, *, date_from, date_to, filters=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    qs = _sales_vat_qs(company, date_from, date_to)
    if filters.get("customer"):
        qs = qs.filter(customer_id=filters["customer"])
    if filters.get("missing_trn"):
        qs = qs.filter(taxable_amount__gt=0).filter(
            Q(customer_trn_snapshot="") | Q(customer_trn_snapshot__isnull=True)
        )
    if filters.get("vat_disabled"):
        qs = qs.filter(vat_rate=0)

    records = [_sales_record(inv) for inv in qs.order_by("invoice_date", "id")]
    agg = qs.aggregate(
        subtotal=Sum("subtotal"),
        taxable=Sum("taxable_amount"),
        vat=Sum("vat_amount"),
        total=Sum("total_amount"),
    )
    cancelled_count = SalesInvoice.objects.filter(
        company=company,
        invoice_date__gte=date_from,
        invoice_date__lte=date_to,
        status=SalesStatus.CANCELLED,
    ).count()

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "records": records,
        "totals": {
            "sales_subtotal": agg["subtotal"] or ZERO,
            "sales_taxable_amount": agg["taxable"] or ZERO,
            "sales_vat_amount": agg["vat"] or ZERO,
            "sales_total_amount": agg["total"] or ZERO,
            "invoice_count": len(records),
            "missing_customer_trn_count": sum(1 for r in records if r["missing_customer_trn"]),
            "vat_disabled_count": sum(1 for r in records if r["vat_disabled"] and _d(r["taxable_amount"]) > 0),
            "cancelled_excluded_count": cancelled_count,
        },
    }


def get_purchase_vat_report(company, *, date_from, date_to, filters=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    qs = _purchase_vat_qs(company, date_from, date_to)
    if filters.get("supplier"):
        qs = qs.filter(supplier_id=filters["supplier"])
    if filters.get("missing_trn"):
        qs = qs.filter(vat_amount__gt=0).filter(
            Q(supplier_trn_snapshot="") | Q(supplier_trn_snapshot__isnull=True)
        )
    if filters.get("vat_disabled"):
        qs = qs.filter(vat_rate=0)

    records = [_purchase_record(inv) for inv in qs.order_by("invoice_date", "id")]
    agg = qs.aggregate(
        subtotal=Sum("subtotal"),
        taxable=Sum("taxable_amount"),
        vat=Sum("vat_amount"),
        total=Sum("total_amount"),
    )
    cancelled_count = PurchaseInvoice.objects.filter(
        company=company,
        invoice_date__gte=date_from,
        invoice_date__lte=date_to,
        status=PurchaseStatus.CANCELLED,
    ).count()

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "records": records,
        "totals": {
            "purchase_subtotal": agg["subtotal"] or ZERO,
            "purchase_taxable_amount": agg["taxable"] or ZERO,
            "purchase_vat_amount": agg["vat"] or ZERO,
            "purchase_total_amount": agg["total"] or ZERO,
            "invoice_count": len(records),
            "missing_supplier_trn_count": sum(1 for r in records if r["missing_supplier_trn"]),
            "vat_disabled_count": sum(1 for r in records if r["vat_disabled"] and _d(r["taxable_amount"]) > 0),
            "cancelled_excluded_count": cancelled_count,
        },
    }


def get_expense_vat_report(company, *, date_from, date_to, filters=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    qs = _expense_vat_qs(company, date_from, date_to)
    if filters.get("category"):
        qs = qs.filter(category_id=filters["category"])
    if filters.get("vat_disabled"):
        qs = qs.filter(vat_rate=0, amount__gt=0)

    records = [_expense_record(exp) for exp in qs.order_by("expense_date", "id")]
    agg = qs.aggregate(
        amount=Sum("amount"),
        vat=Sum("vat_amount"),
        total=Sum("total_amount"),
    )
    cancelled_count = Expense.objects.filter(
        company=company,
        expense_date__gte=date_from,
        expense_date__lte=date_to,
        status=ExpenseStatus.CANCELLED,
    ).count()

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "records": records,
        "totals": {
            "expense_amount": agg["amount"] or ZERO,
            "expense_taxable_amount": agg["amount"] or ZERO,
            "expense_vat_amount": agg["vat"] or ZERO,
            "expense_total_amount": agg["total"] or ZERO,
            "expense_count": len(records),
            "vat_disabled_count": sum(1 for r in records if r["vat_disabled"]),
            "cancelled_excluded_count": cancelled_count,
        },
    }


def _adjustment_output_effect(adj) -> Decimal:
    if adj.status != TaxAdjustmentStatus.POSTED:
        return ZERO
    amt = _d(adj.amount)
    if adj.adjustment_type == TaxAdjustmentType.OUTPUT_VAT_INCREASE:
        return amt
    if adj.adjustment_type == TaxAdjustmentType.OUTPUT_VAT_DECREASE:
        return -amt
    if adj.adjustment_type in (TaxAdjustmentType.ROUNDING_ADJUSTMENT, TaxAdjustmentType.OTHER):
        return amt
    return ZERO


def _adjustment_input_effect(adj) -> Decimal:
    if adj.status != TaxAdjustmentStatus.POSTED:
        return ZERO
    amt = _d(adj.amount)
    if adj.adjustment_type == TaxAdjustmentType.INPUT_VAT_INCREASE:
        return amt
    if adj.adjustment_type == TaxAdjustmentType.INPUT_VAT_DECREASE:
        return -amt
    return ZERO


def _manual_adjustments_total(company, date_from, date_to) -> dict:
    qs = TaxAdjustment.objects.filter(
        company=company,
        adjustment_date__gte=date_from,
        adjustment_date__lte=date_to,
        status=TaxAdjustmentStatus.POSTED,
    )
    output = sum(_adjustment_output_effect(a) for a in qs)
    input_total = sum(_adjustment_input_effect(a) for a in qs)
    return {"output": output, "input": input_total, "net_direct": output}


def get_net_vat_estimate(company, *, date_from, date_to) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    sales = get_sales_vat_report(company, date_from=date_from, date_to=date_to)
    purchases = get_purchase_vat_report(company, date_from=date_from, date_to=date_to)
    expenses = get_expense_vat_report(company, date_from=date_from, date_to=date_to)
    adj = _manual_adjustments_total(company, date_from, date_to)

    sales_vat = _d(sales["totals"]["sales_vat_amount"])
    purchase_vat = _d(purchases["totals"]["purchase_vat_amount"])
    expense_vat = _d(expenses["totals"]["expense_vat_amount"])
    output_vat = sales_vat + adj["output"]
    input_vat = purchase_vat + expense_vat + adj["input"]
    net_vat = output_vat - input_vat

    if net_vat > 0:
        status = "payable"
    elif net_vat < 0:
        status = "recoverable"
    else:
        status = "zero"

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "output_vat": output_vat,
        "purchase_input_vat": purchase_vat,
        "expense_input_vat": expense_vat,
        "total_input_vat": input_vat,
        "manual_adjustments": adj["output"] + adj["input"],
        "net_vat": net_vat,
        "status": status,
        "note": "This is an internal estimate and not an official tax filing.",
    }


def get_tax_summary(company, *, date_from, date_to) -> dict:
    sales = get_sales_vat_report(company, date_from=date_from, date_to=date_to)
    purchases = get_purchase_vat_report(company, date_from=date_from, date_to=date_to)
    expenses = get_expense_vat_report(company, date_from=date_from, date_to=date_to)
    net = get_net_vat_estimate(company, date_from=date_from, date_to=date_to)
    open_warnings = TaxWarning.objects.filter(
        company=company, status=TaxWarningStatus.OPEN,
    ).count()
    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "sales_vat": sales["totals"]["sales_vat_amount"],
        "purchase_vat": purchases["totals"]["purchase_vat_amount"],
        "expense_vat": expenses["totals"]["expense_vat_amount"],
        "net_vat": net["net_vat"],
        "net_vat_status": net["status"],
        "open_warnings_count": open_warnings,
        "note": net["note"],
    }


def _upsert_warning(
    company, *, warning_type, severity, source_type, source_id, source_reference,
    party_name, message,
) -> tuple[TaxWarning, bool]:
    existing = TaxWarning.objects.filter(
        company=company,
        warning_type=warning_type,
        source_type=source_type,
        source_id=str(source_id),
        status=TaxWarningStatus.OPEN,
    ).first()
    if existing:
        return existing, False
    warning = TaxWarning.objects.create(
        company=company,
        warning_type=warning_type,
        severity=severity,
        source_type=source_type,
        source_id=str(source_id),
        source_reference=source_reference,
        party_name=party_name,
        message=message,
    )
    return warning, True


@transaction.atomic
def generate_tax_warnings(company, *, date_from=None, date_to=None) -> dict:
    today = timezone.now().date()
    date_from = date_from or today.replace(day=1)
    date_to = date_to or today
    date_from, date_to = _parse_dates(date_from, date_to)

    vat_settings = _vat_settings(company)
    created = 0

    has_taxable = (
        _sales_vat_qs(company, date_from, date_to).filter(taxable_amount__gt=0).exists()
        or _purchase_vat_qs(company, date_from, date_to).filter(vat_amount__gt=0).exists()
        or _expense_vat_qs(company, date_from, date_to).filter(amount__gt=0).exists()
    )
    if has_taxable and not (company.trn or "").strip():
        _, new = _upsert_warning(
            company,
            warning_type=TaxWarningType.COMPANY_TRN_MISSING,
            severity=TaxWarningSeverity.HIGH,
            source_type=TaxSourceType.COMPANY_SETTINGS,
            source_id=company.id,
            source_reference=company.subdomain,
            party_name=company.name_en,
            message="Company TRN is missing while taxable documents exist in the period.",
        )
        created += int(new)

    for inv in _sales_vat_qs(company, date_from, date_to):
        if _d(inv.taxable_amount) > 0 and not (inv.customer_trn_snapshot or "").strip():
            if vat_settings.warn_missing_customer_trn:
                _, new = _upsert_warning(
                    company,
                    warning_type=TaxWarningType.CUSTOMER_TRN_MISSING,
                    severity=TaxWarningSeverity.MEDIUM,
                    source_type=TaxSourceType.SALES_INVOICE,
                    source_id=inv.id,
                    source_reference=inv.invoice_number,
                    party_name=inv.customer_name_snapshot,
                    message=f"Customer TRN missing on taxable sales invoice {inv.invoice_number}.",
                )
                created += int(new)
        if _is_vat_disabled_doc(
            inv.taxable_amount, inv.vat_rate, inv.vat_amount, vat_settings.vat_enabled_default,
        ):
            _, new = _upsert_warning(
                company,
                warning_type=TaxWarningType.VAT_DISABLED_SALES,
                severity=TaxWarningSeverity.MEDIUM,
                source_type=TaxSourceType.SALES_INVOICE,
                source_id=inv.id,
                source_reference=inv.invoice_number,
                party_name=inv.customer_name_snapshot,
                message=f"VAT disabled/zero on taxable sales invoice {inv.invoice_number}.",
            )
            created += int(new)
        expected = _expected_vat(inv.taxable_amount, inv.vat_rate)
        if abs(_d(inv.vat_amount) - expected) > VAT_TOLERANCE and _d(inv.taxable_amount) > 0:
            _, new = _upsert_warning(
                company,
                warning_type=TaxWarningType.VAT_AMOUNT_MISMATCH,
                severity=TaxWarningSeverity.HIGH,
                source_type=TaxSourceType.SALES_INVOICE,
                source_id=inv.id,
                source_reference=inv.invoice_number,
                party_name=inv.customer_name_snapshot,
                message=f"VAT amount mismatch on sales invoice {inv.invoice_number}.",
            )
            created += int(new)

    for inv in _purchase_vat_qs(company, date_from, date_to):
        if _d(inv.vat_amount) > 0 and not (inv.supplier_trn_snapshot or "").strip():
            if vat_settings.warn_missing_supplier_trn:
                _, new = _upsert_warning(
                    company,
                    warning_type=TaxWarningType.SUPPLIER_TRN_MISSING,
                    severity=TaxWarningSeverity.MEDIUM,
                    source_type=TaxSourceType.PURCHASE_INVOICE,
                    source_id=inv.id,
                    source_reference=inv.invoice_number,
                    party_name=inv.supplier_name_snapshot,
                    message=f"Supplier TRN missing on purchase invoice {inv.invoice_number}.",
                )
                created += int(new)
        if _is_vat_disabled_doc(
            inv.taxable_amount, inv.vat_rate, inv.vat_amount, vat_settings.vat_enabled_default,
        ):
            _, new = _upsert_warning(
                company,
                warning_type=TaxWarningType.VAT_DISABLED_PURCHASE,
                severity=TaxWarningSeverity.MEDIUM,
                source_type=TaxSourceType.PURCHASE_INVOICE,
                source_id=inv.id,
                source_reference=inv.invoice_number,
                party_name=inv.supplier_name_snapshot,
                message=f"VAT disabled/zero on taxable purchase invoice {inv.invoice_number}.",
            )
            created += int(new)

    for exp in _expense_vat_qs(company, date_from, date_to):
        if _is_vat_disabled_doc(
            exp.amount, exp.vat_rate, exp.vat_amount, vat_settings.vat_enabled_default,
        ):
            _, new = _upsert_warning(
                company,
                warning_type=TaxWarningType.VAT_DISABLED_EXPENSE,
                severity=TaxWarningSeverity.LOW,
                source_type=TaxSourceType.EXPENSE,
                source_id=exp.id,
                source_reference=exp.expense_number,
                party_name=exp.vendor_name,
                message=f"VAT disabled/zero on expense {exp.expense_number}.",
            )
            created += int(new)

    for inv in SalesInvoice.objects.filter(
        company=company, invoice_date__gte=date_from, invoice_date__lte=date_to,
        status=SalesStatus.CANCELLED,
    ):
        _, new = _upsert_warning(
            company,
            warning_type=TaxWarningType.SALES_INVOICE_CANCELLED,
            severity=TaxWarningSeverity.LOW,
            source_type=TaxSourceType.SALES_INVOICE,
            source_id=inv.id,
            source_reference=inv.invoice_number,
            party_name=inv.customer_name_snapshot,
            message=f"Sales invoice {inv.invoice_number} was cancelled during the period.",
        )
        created += int(new)

    vat_template = PrintTemplateSettings.objects.filter(
        company=company, template_type="vat_report",
    ).first()
    if vat_template and not vat_template.show_trn:
        _, new = _upsert_warning(
            company,
            warning_type=TaxWarningType.MISSING_PRINT_TEMPLATE_TAX_FIELDS,
            severity=TaxWarningSeverity.LOW,
            source_type=TaxSourceType.COMPANY_SETTINGS,
            source_id="vat_report_template",
            source_reference="vat_report",
            party_name="",
            message="VAT report print template has show_trn disabled.",
        )
        created += int(new)

    open_count = TaxWarning.objects.filter(
        company=company, status=TaxWarningStatus.OPEN,
    ).count()
    return {"generated_count": created, "open_count": open_count}


@transaction.atomic
def dismiss_tax_warning(*, warning, user, reason) -> TaxWarning:
    reason = require_reason_for_sensitive_action("tax_warning_dismiss", reason)
    if warning.status != TaxWarningStatus.OPEN:
        raise ValidationError("Only open warnings can be dismissed.")
    warning.status = TaxWarningStatus.DISMISSED
    warning.dismissed_by = user
    warning.dismissed_at = timezone.now()
    warning.dismiss_reason = reason
    warning.save(update_fields=[
        "status", "dismissed_by", "dismissed_at", "dismiss_reason", "updated_at",
    ])
    create_audit_log(
        action="tax_warning_dismiss", user=user, company=warning.company,
        module="tax", reference_type="tax_warning", reference_id=warning.id,
        reason=reason, new_value={"status": warning.status},
    )
    return warning


@transaction.atomic
def resolve_tax_warning(*, warning, user, reason="") -> TaxWarning:
    if warning.status == TaxWarningStatus.RESOLVED:
        raise ValidationError("Warning is already resolved.")
    warning.status = TaxWarningStatus.RESOLVED
    warning.resolved_by = user
    warning.resolved_at = timezone.now()
    warning.save(update_fields=["status", "resolved_by", "resolved_at", "updated_at"])
    create_audit_log(
        action="tax_warning_resolve", user=user, company=warning.company,
        module="tax", reference_type="tax_warning", reference_id=warning.id,
        reason=reason or "", new_value={"status": warning.status},
    )
    return warning


@transaction.atomic
def create_tax_adjustment(
    *,
    company,
    user,
    adjustment_date,
    adjustment_type,
    amount,
    reason,
    notes="",
    related_source_type="",
    related_source_id="",
) -> TaxAdjustment:
    reason = require_reason_for_sensitive_action("tax_adjustment_create", reason)
    amount = _d(amount)
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be positive."})

    closed_period = TaxPeriod.objects.filter(
        company=company, status=TaxPeriodStatus.CLOSED,
        start_date__lte=adjustment_date, end_date__gte=adjustment_date,
    ).exists()
    if closed_period:
        raise ValidationError("Cannot post adjustment into a closed tax period.")

    adjustment_number = generate_document_number(company, DocumentType.TAX_ADJUSTMENT)
    adjustment = TaxAdjustment.objects.create(
        company=company,
        adjustment_number=adjustment_number,
        adjustment_date=adjustment_date,
        adjustment_type=adjustment_type,
        amount=amount,
        reason=reason,
        notes=notes,
        related_source_type=related_source_type,
        related_source_id=str(related_source_id) if related_source_id else "",
        posted_by=user,
    )
    create_audit_log(
        action="tax_adjustment_create", user=user, company=company,
        module="tax", reference_type="tax_adjustment", reference_id=adjustment.id,
        reason=reason,
        new_value={
            "adjustment_number": adjustment.adjustment_number,
            "amount": str(adjustment.amount),
            "adjustment_type": adjustment_type,
        },
    )
    return adjustment


@transaction.atomic
def cancel_tax_adjustment(*, adjustment, user, reason) -> TaxAdjustment:
    reason = require_reason_for_sensitive_action("tax_adjustment_cancel", reason)
    adjustment = TaxAdjustment.objects.select_for_update().get(pk=adjustment.pk)
    if adjustment.status == TaxAdjustmentStatus.CANCELLED:
        raise ValidationError("Adjustment is already cancelled.")
    adjustment.status = TaxAdjustmentStatus.CANCELLED
    adjustment.cancelled_by = user
    adjustment.cancelled_at = timezone.now()
    adjustment.cancel_reason = reason
    adjustment.save(update_fields=[
        "status", "cancelled_by", "cancelled_at", "cancel_reason", "updated_at",
    ])
    create_audit_log(
        action="tax_adjustment_cancel", user=user, company=adjustment.company,
        module="tax", reference_type="tax_adjustment", reference_id=adjustment.id,
        reason=reason, new_value={"status": adjustment.status},
    )
    return adjustment


def get_disabled_vat_documents(company, *, date_from, date_to) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    vat_settings = _vat_settings(company)
    if not vat_settings.vat_enabled_default:
        return {"date_from": str(date_from), "date_to": str(date_to), "records": []}

    records = []
    for inv in _sales_vat_qs(company, date_from, date_to):
        if _is_vat_disabled_doc(inv.taxable_amount, inv.vat_rate, inv.vat_amount, True):
            records.append({**_sales_record(inv), "document_type": "sales_invoice"})
    for inv in _purchase_vat_qs(company, date_from, date_to):
        if _is_vat_disabled_doc(inv.taxable_amount, inv.vat_rate, inv.vat_amount, True):
            records.append({**_purchase_record(inv), "document_type": "purchase_invoice"})
    for exp in _expense_vat_qs(company, date_from, date_to):
        if _is_vat_disabled_doc(exp.amount, exp.vat_rate, exp.vat_amount, True):
            records.append({**_expense_record(exp), "document_type": "expense"})
    return {"date_from": str(date_from), "date_to": str(date_to), "records": records}


def get_tax_audit_entries(company, *, date_from=None, date_to=None, limit=100) -> list:
    qs = AuditLog.objects.filter(company=company, module="tax").order_by("-created_at")
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    return [
        {
            "id": row.id,
            "action": row.action,
            "reference_type": row.reference_type,
            "reference_id": row.reference_id,
            "reason": row.reason,
            "risk_level": row.risk_level,
            "created_at": row.created_at.isoformat(),
            "user": row.user.full_name if row.user else "",
        }
        for row in qs[:limit]
    ]


def build_tax_export_payload(
    company, *, report_type, date_from, date_to, user=None,
) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    report_type = report_type or "vat_summary"

    if report_type == "sales_vat":
        report_data = get_sales_vat_report(company, date_from=date_from, date_to=date_to)
    elif report_type == "purchase_vat":
        report_data = get_purchase_vat_report(company, date_from=date_from, date_to=date_to)
    elif report_type == "expense_vat":
        report_data = get_expense_vat_report(company, date_from=date_from, date_to=date_to)
    elif report_type == "net_vat":
        report_data = get_net_vat_estimate(company, date_from=date_from, date_to=date_to)
    else:
        report_data = get_tax_summary(company, date_from=date_from, date_to=date_to)
        report_type = "vat_summary"

    warnings = list(
        TaxWarning.objects.filter(company=company, status=TaxWarningStatus.OPEN)
        .values("warning_type", "severity", "message", "source_reference")[:50]
    )

    if user:
        create_audit_log(
            action="tax_report_export", user=user, company=company,
            module="tax", reference_type="tax_report", reference_id=report_type,
            reason="", new_value={"report_type": report_type, "date_from": str(date_from)},
            risk_level=risk_for_action("tax_report_export"),
        )

    return {
        "metadata": {
            "report_type": report_type,
            "generated_at": timezone.now().isoformat(),
            "generated_by": user.full_name if user else "",
            "disclaimer": "Internal VAT report — not an official tax filing.",
        },
        "company": {
            "name_ar": company.name_ar,
            "name_en": company.name_en,
            "trn": company.trn,
        },
        "date_from": str(date_from),
        "date_to": str(date_to),
        "report": report_data,
        "warnings_summary": warnings,
    }


@transaction.atomic
def review_tax_period(*, period, user) -> TaxPeriod:
    if period.status == TaxPeriodStatus.CLOSED:
        raise ValidationError("Closed period cannot be reviewed.")
    period.status = TaxPeriodStatus.REVIEWED
    period.reviewed_by = user
    period.reviewed_at = timezone.now()
    period.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    return period


@transaction.atomic
def close_tax_period(*, period, user) -> TaxPeriod:
    if period.status == TaxPeriodStatus.CLOSED:
        raise ValidationError("Period is already closed.")
    period.status = TaxPeriodStatus.CLOSED
    period.closed_by = user
    period.closed_at = timezone.now()
    period.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
    return period
