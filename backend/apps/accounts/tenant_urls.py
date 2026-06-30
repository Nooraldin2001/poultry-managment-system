from django.urls import path

from .views import (
    MeView,
    TenantUserDetailView,
    TenantUserListCreateView,
    TenantUserReactivateView,
    TenantUserSuspendView,
)

# Mounted under /api/v1/tenant/
urlpatterns = [
    path("me/", MeView.as_view(), name="tenant-me"),
    path("users/", TenantUserListCreateView.as_view(), name="tenant-users"),
    path("users/<int:pk>/", TenantUserDetailView.as_view(), name="tenant-user-detail"),
    path(
        "users/<int:pk>/suspend/",
        TenantUserSuspendView.as_view(),
        name="tenant-user-suspend",
    ),
    path(
        "users/<int:pk>/reactivate/",
        TenantUserReactivateView.as_view(),
        name="tenant-user-reactivate",
    ),
]
