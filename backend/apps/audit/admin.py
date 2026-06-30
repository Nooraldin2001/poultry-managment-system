from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only: audit entries are append-only and cannot be edited/added/deleted."""

    list_display = [
        "created_at", "action", "module", "user", "company",
        "reference_type", "reference_id", "risk_level",
    ]
    list_filter = ["risk_level", "module", "action"]
    search_fields = ["action", "module", "reason", "reference_type"]
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]
