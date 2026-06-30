from rest_framework.routers import DefaultRouter

from .views import CustomerCategoryViewSet, CustomerViewSet

router = DefaultRouter()
router.register("customer-categories", CustomerCategoryViewSet, basename="customer-categories")
router.register("customers", CustomerViewSet, basename="customers")

urlpatterns = router.urls
