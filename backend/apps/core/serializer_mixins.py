"""Shared DRF serializer mixins."""

from django.utils import timezone

from apps.core.document_dates import validate_invoice_document_date


class InvoiceDateValidationMixin:
    """Validate invoice_date, backdate permission, and reason on create/update."""

    backdate_permission_code = "sales.backdate"

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        company = self.context.get("company")
        if request is None or company is None:
            return attrs

        instance = self.context.get("instance")
        invoice_date = attrs.get("invoice_date")
        if invoice_date is None:
            return attrs

        is_approved = bool(
            instance is not None and getattr(instance, "status", "draft") != "draft"
        )
        previous_date = instance.invoice_date if instance else None
        cleaned_reason = validate_invoice_document_date(
            user=request.user,
            company=company,
            document_date=invoice_date,
            permission_code=self.backdate_permission_code,
            backdate_reason=attrs.get("backdate_reason", ""),
            previous_date=previous_date,
            is_approved=is_approved,
        )
        if cleaned_reason:
            attrs["backdate_reason"] = cleaned_reason
        elif invoice_date >= timezone.localdate():
            attrs.pop("backdate_reason", None)
        return attrs


class PurchaseInvoiceDateValidationMixin(InvoiceDateValidationMixin):
    backdate_permission_code = "purchases.backdate"
