from rest_framework.routers import DefaultRouter

from .views import ProductCategoryViewSet, ProductViewSet

router = DefaultRouter()
router.register("product-categories", ProductCategoryViewSet, basename="product-categories")
router.register("products", ProductViewSet, basename="products")

urlpatterns = router.urls
