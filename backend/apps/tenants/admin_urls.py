from django.urls import path

from .views import (
    AdminCompanyCreateAdminUserView,
    AdminCompanyDetailView,
    AdminCompanyListCreateView,
    AdminCompanyReactivateView,
    AdminCompanySuspendView,
)

# Mounted under /api/v1/admin/
urlpatterns = [
    path("companies/", AdminCompanyListCreateView.as_view(), name="admin-companies"),
    path("companies/<int:pk>/", AdminCompanyDetailView.as_view(), name="admin-company-detail"),
    path(
        "companies/<int:pk>/suspend/",
        AdminCompanySuspendView.as_view(),
        name="admin-company-suspend",
    ),
    path(
        "companies/<int:pk>/reactivate/",
        AdminCompanyReactivateView.as_view(),
        name="admin-company-reactivate",
    ),
    path(
        "companies/<int:pk>/create-admin-user/",
        AdminCompanyCreateAdminUserView.as_view(),
        name="admin-company-create-admin-user",
    ),
]
