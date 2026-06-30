from django.urls import path

from .views import PermissionCatalogView, UserPermissionsView

# Mounted under /api/v1/tenant/
urlpatterns = [
    path("permissions/", PermissionCatalogView.as_view(), name="tenant-permissions"),
    path(
        "users/<int:pk>/permissions/",
        UserPermissionsView.as_view(),
        name="tenant-user-permissions",
    ),
]
