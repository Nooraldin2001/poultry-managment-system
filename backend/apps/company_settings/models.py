from decimal import Decimal

from django.db import models

from apps.core.models import TimeStampedModel

from .constants import (
    DocumentType,
    PaperSize,
    ResetRule,
    TemplateType,
)
from .invoice_design import (
    DEFAULT_COLOR_THEME,
    DEFAULT_TEMPLATE_KEY,
    InvoiceColorTheme,
    InvoiceTemplateKey,
)


class VATSettings(TimeStampedModel):
    """Per-company VAT configuration (1—1 with company)."""

    company = models.OneToOneField(
        "tenants.Company", on_delete=models.CASCADE, related_name="vat_settings"
    )
    vat_enabled_default = models.BooleanField(default=True)
    default_vat_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("5.00")
    )
    allow_vat_disable_sales = models.BooleanField(default=True)
    allow_vat_disable_purchase = models.BooleanField(default=True)
    require_reason_for_vat_change = models.BooleanField(default=True)
    warn_missing_customer_trn = models.BooleanField(default=True)
    warn_missing_supplier_trn = models.BooleanField(default=True)

    class Meta:
        verbose_name = "VAT settings"
        verbose_name_plural = "VAT settings"

    def __str__(self):
        return f"VAT settings · {self.company.subdomain}"


class NumberingSettings(TimeStampedModel):
    """Document numbering config + counter per document type, per company."""

    company = models.ForeignKey(
        "tenants.Company", on_delete=models.CASCADE, related_name="numbering_settings"
    )
    document_type = models.CharField(max_length=32, choices=DocumentType.choices)
    prefix = models.CharField(max_length=16, blank=True)
    next_number = models.PositiveIntegerField(default=1)
    number_length = models.PositiveSmallIntegerField(default=5)
    reset_rule = models.CharField(
        max_length=10, choices=ResetRule.choices, default=ResetRule.NONE
    )
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "document_type"],
                name="uniq_company_document_numbering",
            )
        ]
        ordering = ["document_type"]

    def __str__(self):
        return f"{self.company.subdomain} · {self.document_type}"


class InvoiceDesignSettings(TimeStampedModel):
    """Company-level invoice template + color theme selection (1—1 with company).

    Applies to sales/purchase invoice print previews. Created lazily with
    defaults, so existing tenants keep working without a data migration.
    """

    company = models.OneToOneField(
        "tenants.Company", on_delete=models.CASCADE, related_name="invoice_design"
    )
    invoice_template_key = models.CharField(
        max_length=32,
        choices=InvoiceTemplateKey.choices,
        default=DEFAULT_TEMPLATE_KEY,
    )
    invoice_color_theme = models.CharField(
        max_length=32,
        choices=InvoiceColorTheme.choices,
        default=DEFAULT_COLOR_THEME,
    )
    show_logo = models.BooleanField(default=True)
    show_stamp = models.BooleanField(default=True)
    show_signature = models.BooleanField(default=True)
    show_company_trn = models.BooleanField(default=True)
    show_company_phone = models.BooleanField(default=True)
    show_customer_trn = models.BooleanField(default=True)
    show_supplier_trn = models.BooleanField(default=True)
    show_bilingual_labels = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Invoice design settings"
        verbose_name_plural = "Invoice design settings"

    def __str__(self):
        return f"Invoice design · {self.company.subdomain}"


class PrintTemplateSettings(TimeStampedModel):
    """Print/PDF template config per template type, per company."""

    company = models.ForeignKey(
        "tenants.Company", on_delete=models.CASCADE, related_name="print_templates"
    )
    template_type = models.CharField(max_length=32, choices=TemplateType.choices)
    show_logo = models.BooleanField(default=True)
    show_stamp = models.BooleanField(default=False)
    show_signature = models.BooleanField(default=False)
    show_trn = models.BooleanField(default=True)
    show_arabic_labels = models.BooleanField(default=True)
    show_english_labels = models.BooleanField(default=True)
    show_amount_in_words = models.BooleanField(default=False)
    footer_notes = models.TextField(blank=True)
    receiver_signature_required = models.BooleanField(default=False)
    paper_size = models.CharField(
        max_length=12, choices=PaperSize.choices, default=PaperSize.A4
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "template_type"],
                name="uniq_company_template_type",
            )
        ]
        ordering = ["template_type"]

    def __str__(self):
        return f"{self.company.subdomain} · {self.template_type}"
