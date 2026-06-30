from django.contrib import admin

from .models import PermissionCode, RolePermissionDefault, UserPermissionOverride


@admin.register(PermissionCode)
class PermissionCodeAdmin(admin.ModelAdmin):
    list_display = ["code", "group", "action", "is_sensitive", "is_active"]
    list_filter = ["group", "is_sensitive", "is_active"]
    search_fields = ["code"]


@admin.register(RolePermissionDefault)
class RolePermissionDefaultAdmin(admin.ModelAdmin):
    list_display = ["role", "permission", "allowed"]
    list_filter = ["role", "allowed"]
    search_fields = ["permission__code"]


@admin.register(UserPermissionOverride)
class UserPermissionOverrideAdmin(admin.ModelAdmin):
    list_display = ["user", "permission", "allowed", "set_by"]
    list_filter = ["allowed"]
    search_fields = ["user__email", "permission__code"]
