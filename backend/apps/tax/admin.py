from django.contrib import admin

from .models import TaxAdjustment, TaxPeriod, TaxWarning


@admin.register(TaxPeriod)
class TaxPeriodAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "start_date", "end_date", "status")
    list_filter = ("status", "company")
    readonly_fields = ("reviewed_by", "reviewed_at", "closed_by", "closed_at", "created_by")


@admin.register(TaxWarning)
class TaxWarningAdmin(admin.ModelAdmin):
    list_display = (
        "warning_type", "severity", "status", "source_type", "source_reference", "company",
    )
    list_filter = ("warning_type", "severity", "status", "company")
    readonly_fields = (
        "warning_type", "severity", "source_type", "source_id", "message",
        "dismissed_by", "dismissed_at", "resolved_by", "resolved_at",
    )

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TaxAdjustment)
class TaxAdjustmentAdmin(admin.ModelAdmin):
    list_display = (
        "adjustment_number", "company", "adjustment_type", "amount", "status", "adjustment_date",
    )
    list_filter = ("adjustment_type", "status", "company")
    readonly_fields = (
        "adjustment_number", "amount", "posted_by", "posted_at",
        "cancelled_by", "cancelled_at",
    )

    def has_delete_permission(self, request, obj=None):
        return False
