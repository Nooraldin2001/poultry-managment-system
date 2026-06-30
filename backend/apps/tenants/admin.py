from django.contrib import admin

from .models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name_en", "subdomain", "status", "is_active", "created_at"]
    list_filter = ["status", "is_active", "emirate"]
    search_fields = ["name_en", "name_ar", "subdomain", "trn"]
    readonly_fields = ["created_at", "updated_at"]
