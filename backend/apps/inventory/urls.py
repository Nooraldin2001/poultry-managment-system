from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    InventoryBalanceListView,
    InventorySummaryView,
    InventoryValuationView,
    LowStockView,
    MovementListView,
    OpeningStockView,
    ProductInventoryDetailView,
    ProductMovementsView,
    StockAdjustmentViewSet,
    StocktakingViewSet,
)

router = DefaultRouter()
router.register("inventory/adjustments", StockAdjustmentViewSet, basename="inventory-adjustments")
router.register("inventory/stocktaking", StocktakingViewSet, basename="inventory-stocktaking")

urlpatterns = [
    path("inventory/", InventoryBalanceListView.as_view(), name="inventory-list"),
    path("inventory/summary/", InventorySummaryView.as_view(), name="inventory-summary"),
    path("inventory/valuation/", InventoryValuationView.as_view(), name="inventory-valuation"),
    path("inventory/low-stock/", LowStockView.as_view(), name="inventory-low-stock"),
    path("inventory/movements/", MovementListView.as_view(), name="inventory-movements"),
    path("inventory/opening-stock/", OpeningStockView.as_view(), name="inventory-opening-stock"),
    path(
        "inventory/products/<int:product_id>/",
        ProductInventoryDetailView.as_view(),
        name="inventory-product-detail",
    ),
    path(
        "inventory/products/<int:product_id>/movements/",
        ProductMovementsView.as_view(),
        name="inventory-product-movements",
    ),
    *router.urls,
]
