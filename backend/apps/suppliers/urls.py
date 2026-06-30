from rest_framework.routers import DefaultRouter

from .views import SupplierCategoryViewSet, SupplierViewSet

router = DefaultRouter()
router.register("supplier-categories", SupplierCategoryViewSet, basename="supplier-categories")
router.register("suppliers", SupplierViewSet, basename="suppliers")

urlpatterns = router.urls
