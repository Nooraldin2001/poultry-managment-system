"""Business-date validation for invoices and related documents."""

from __future__ import annotations

from datetime import date

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.permissions.services import has_permission

BACKDATE_PERMISSION_DENIED_EN = (
    "You do not have permission to create a backdated invoice"
)
BACKDATE_PERMISSION_DENIED_AR = "لا تملك صلاحية إنشاء فاتورة بتاريخ سابق"


def validate_document_date_is_open(company, document_date: date, user=None) -> None:
    """Reject documents in a closed tax period unless user has tax.sensitive."""
    from apps.tax.models import TaxPeriod, TaxPeriodStatus

    closed = TaxPeriod.objects.filter(
        company=company,
        status=TaxPeriodStatus.CLOSED,
        start_date__lte=document_date,
        end_date__gte=document_date,
    ).exists()
    if not closed:
        return
    if user and has_permission(user, "tax.sensitive", company):
        return
    raise ValidationError(
        {"invoice_date": "Cannot create or edit a document in a closed tax period."}
    )


def validate_invoice_document_date(
    *,
    user,
    company,
    document_date: date,
    permission_code: str,
    backdate_reason: str = "",
    previous_date: date | None = None,
    is_approved: bool = False,
) -> str | None:
    """Validate invoice_date rules. Returns cleaned backdate_reason when applicable."""
    today = timezone.localdate()

    if document_date > today:
        raise ValidationError({"invoice_date": "Invoice date cannot be in the future."})

    if is_approved and previous_date is not None and document_date != previous_date:
        raise ValidationError(
            {"invoice_date": "Invoice date cannot be changed after approval."}
        )

    validate_document_date_is_open(company, document_date, user)

    if document_date >= today:
        return None

    if not has_permission(user, permission_code, company):
        raise PermissionDenied(
            {
                "detail": BACKDATE_PERMISSION_DENIED_EN,
                "detail_ar": BACKDATE_PERMISSION_DENIED_AR,
            }
        )

    cleaned_reason = (backdate_reason or "").strip()
    if not cleaned_reason:
        raise ValidationError(
            {
                "backdate_reason": (
                    "Backdate reason is required when invoice date is before today."
                )
            }
        )
    return cleaned_reason


def ensure_backdate_reason_for_approval(invoice, provided_reason: str = "") -> bool:
    """Ensure a backdated invoice carries a reason before approval.

    An invoice that already stores a valid ``backdate_reason`` approves without
    requiring the reason again. A backdated invoice missing its reason accepts
    the ``provided_reason`` fallback from the approve payload; otherwise a
    clear bilingual error is raised.

    Returns True when ``invoice.backdate_reason`` was set from the fallback
    (the caller must include it in ``update_fields``).
    """
    if invoice.invoice_date >= timezone.localdate():
        return False
    if (invoice.backdate_reason or "").strip():
        return False
    cleaned = (provided_reason or "").strip()
    if not cleaned:
        raise ValidationError({
            "backdate_reason": (
                "Backdate reason is required to approve a backdated invoice / "
                "سبب إدخال تاريخ سابق مطلوب لاعتماد فاتورة بتاريخ سابق"
            )
        })
    invoice.backdate_reason = cleaned
    return True


def invoice_date_to_received_at(invoice_date: date):
    """Convert business invoice date to timezone-aware datetime for FIFO layers."""
    from datetime import datetime, time

    return timezone.make_aware(datetime.combine(invoice_date, time.min))


def log_backdated_invoice(
    *,
    user,
    company,
    module: str,
    reference_type: str,
    invoice_id,
    invoice_date: date,
    backdate_reason: str,
    created_at,
) -> None:
    """Record audit trail when an invoice is created or saved with a past business date."""
    if invoice_date >= timezone.localdate():
        return
    from apps.audit.services import create_audit_log

    create_audit_log(
        action=f"backdate_{reference_type}",
        user=user,
        company=company,
        module=module,
        reference_type=reference_type,
        reference_id=invoice_id,
        reason=backdate_reason,
        new_value={
            "invoice_date": str(invoice_date),
            "created_at": created_at.isoformat() if created_at else None,
            "backdate_reason": backdate_reason,
        },
    )
