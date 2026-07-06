from django.urls import path

from .views import (
    InvoiceDesignCatalogView,
    InvoiceDesignSettingsView,
    NumberingListView,
    NumberingUpdateView,
    PrintTemplateListView,
    PrintTemplateUpdateView,
    VATSettingsView,
)

# Mounted under /api/v1/tenant/settings/
urlpatterns = [
    path("vat/", VATSettingsView.as_view(), name="tenant-vat-settings"),
    path(
        "print-template/",
        InvoiceDesignSettingsView.as_view(),
        name="tenant-invoice-design",
    ),
    path(
        "print-template/catalog/",
        InvoiceDesignCatalogView.as_view(),
        name="tenant-invoice-design-catalog",
    ),
    path("numbering/", NumberingListView.as_view(), name="tenant-numbering"),
    path("numbering/<int:pk>/", NumberingUpdateView.as_view(), name="tenant-numbering-detail"),
    path("print-templates/", PrintTemplateListView.as_view(), name="tenant-print-templates"),
    path(
        "print-templates/<int:pk>/",
        PrintTemplateUpdateView.as_view(),
        name="tenant-print-template-detail",
    ),
]
