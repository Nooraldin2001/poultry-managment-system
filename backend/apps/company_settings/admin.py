from django.contrib import admin

from .models import (
    InvoiceDesignSettings,
    NumberingSettings,
    PrintTemplateSettings,
    VATSettings,
)


@admin.register(VATSettings)
class VATSettingsAdmin(admin.ModelAdmin):
    list_display = ["company", "vat_enabled_default", "default_vat_rate"]
    search_fields = ["company__subdomain"]


@admin.register(NumberingSettings)
class NumberingSettingsAdmin(admin.ModelAdmin):
    list_display = ["company", "document_type", "prefix", "next_number", "active"]
    list_filter = ["document_type", "active"]
    search_fields = ["company__subdomain"]


@admin.register(PrintTemplateSettings)
class PrintTemplateSettingsAdmin(admin.ModelAdmin):
    list_display = ["company", "template_type", "paper_size"]
    list_filter = ["template_type", "paper_size"]
    search_fields = ["company__subdomain"]


@admin.register(InvoiceDesignSettings)
class InvoiceDesignSettingsAdmin(admin.ModelAdmin):
    list_display = ["company", "invoice_template_key", "invoice_color_theme"]
    list_filter = ["invoice_template_key", "invoice_color_theme"]
    search_fields = ["company__subdomain"]
