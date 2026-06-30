from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services import record_action
from apps.core.viewsets import TenantScopedViewSet

from .models import Product, ProductCategory
from .serializers import (
    ProductCategorySerializer,
    ProductCreateUpdateSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ProductPriceSummarySerializer,
    ProductUsageSerializer,
)

PRICE_FIELDS = {"sales_price", "sales_price_type", "purchase_price", "purchase_price_type"}
CARTON_FIELDS = {"weight_grams", "default_pieces_per_carton"}


class ProductCategoryViewSet(TenantScopedViewSet):
    queryset = ProductCategory.objects.all()
    serializer_class = ProductCategorySerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "products.view",
        "retrieve": "products.view",
        "create": "products.manage_settings",
        "partial_update": "products.manage_settings",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs


class ProductViewSet(TenantScopedViewSet):
    queryset = Product.objects.select_related("category").all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "products.view",
        "retrieve": "products.view",
        "create": "products.create",
        "partial_update": "products.edit",
        "disable": "products.disable",
        "reactivate": "products.disable",
        "prices": "products.view",
        "usage": "products.view",
    }

    def get_serializer_class(self):
        if self.action == "list":
            return ProductListSerializer
        if self.action in ("create", "partial_update"):
            return ProductCreateUpdateSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        is_active = params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        category = params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        product_type = params.get("product_type") or params.get("type")
        if product_type:
            qs = qs.filter(product_type=product_type)
        search = params.get("search") or params.get("q")
        if search:
            from django.db.models import Q

            qs = qs.filter(
                Q(name_ar__icontains=search)
                | Q(name_en__icontains=search)
                | Q(sku__icontains=search)
            )
        if params.get("missing_price") in ("1", "true", "yes"):
            qs = qs.filter(sales_price=0)
        return qs

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # Capture old values BEFORE validation (serializer.validate mutates the
        # instance in place to run model.clean()).
        old = {f: getattr(instance, f) for f in (PRICE_FIELDS | CARTON_FIELDS)}
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changed = serializer.validated_data

        price_changed = any(
            field in changed and changed[field] != old[field] for field in PRICE_FIELDS
        )
        carton_changed = any(
            field in changed and changed[field] != old[field] for field in CARTON_FIELDS
        )
        reason = (request.data.get("reason") or "").strip()
        before = {f: str(v) for f, v in old.items()}

        if price_changed:
            record_action(
                request=request, action="product_price_change", module="products",
                reference_type="product", reference_id=instance.id,
                previous_value=before, new_value=None, reason=reason,
            )
        if carton_changed:
            record_action(
                request=request, action="product_carton_rule_change", module="products",
                reference_type="product", reference_id=instance.id,
                previous_value=before, new_value=None, reason=reason,
            )

        self.perform_update(serializer)
        return Response(ProductDetailSerializer(instance, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        product = self.get_object()
        reason = (request.data.get("reason") or "").strip()
        record_action(
            request=request, action="product_disable", module="products",
            reference_type="product", reference_id=product.id,
            previous_value={"is_active": True}, new_value={"is_active": False},
            reason=reason,
        )
        product.is_active = False
        product.disabled_at = timezone.now()
        product.disabled_by = request.user
        product.disable_reason = reason
        product.save(update_fields=["is_active", "disabled_at", "disabled_by", "disable_reason"])
        return Response(ProductDetailSerializer(product, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        product = self.get_object()
        product.is_active = True
        product.disabled_at = None
        product.disabled_by = None
        product.disable_reason = ""
        product.save(update_fields=["is_active", "disabled_at", "disabled_by", "disable_reason"])
        return Response(ProductDetailSerializer(product, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["get"])
    def prices(self, request, pk=None):
        product = self.get_object()
        return Response(ProductPriceSummarySerializer(product).data)

    @action(detail=True, methods=["get"])
    def usage(self, request, pk=None):
        product = self.get_object()
        data = {
            "product_id": product.id,
            "used_in_sales": 0,
            "used_in_purchases": 0,
            "used_in_quotations": 0,
            "has_inventory": False,
            "can_delete": False,
        }
        return Response(ProductUsageSerializer(data).data)
