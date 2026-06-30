"""Inventory API (Phase 3) under /api/v1/tenant/inventory/.

Read endpoints are plain APIViews; adjustments and stocktaking use the shared
``TenantScopedViewSet``. All business logic is delegated to ``services`` so the
views only handle permission gating, (de)serialization and shaping responses.
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasTenantPermission, IsTenantUser
from apps.core.viewsets import TenantScopedViewSet
from apps.permissions.services import has_permission

from . import services
from .models import (
    InventoryBalance,
    StockAdjustment,
    StockMovement,
    StocktakingLine,
    StocktakingSession,
)
from .serializers import (
    InventoryBalanceSerializer,
    InventoryProductDetailSerializer,
    InventorySummarySerializer,
    InventoryValuationSerializer,
    OpeningStockSerializer,
    StockAdjustmentCreateSerializer,
    StockAdjustmentDetailSerializer,
    StockMovementSerializer,
    StocktakingApplySerializer,
    StocktakingLineCreateSerializer,
    StocktakingLineSerializer,
    StocktakingSessionCreateSerializer,
    StocktakingSessionDetailSerializer,
    StocktakingSessionListSerializer,
)

VALUATION_PERMISSION = "inventory.view_valuation"


def _truthy(value) -> bool:
    return str(value).lower() in ("1", "true", "yes")


class _TenantAPIView(APIView):
    """APIView scoped to the tenant with a single declared permission."""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "inventory.view"

    @property
    def company(self):
        return self.request.user.company

    def can_view_valuation(self) -> bool:
        return has_permission(self.request.user, VALUATION_PERMISSION)


class InventoryBalanceListView(_TenantAPIView):
    required_permission = "inventory.view"

    def get(self, request):
        qs = (
            InventoryBalance.objects.select_related("product", "product__category")
            .filter(company_id=request.user.company_id)
        )
        p = request.query_params
        if p.get("product"):
            qs = qs.filter(product_id=p["product"])
        if p.get("category"):
            qs = qs.filter(product__category_id=p["category"])
        if p.get("search"):
            qs = qs.filter(
                Q(product__name_ar__icontains=p["search"])
                | Q(product__name_en__icontains=p["search"])
                | Q(product__sku__icontains=p["search"])
            )
        balances = list(qs.order_by("product__name_ar"))

        if _truthy(p.get("out_of_stock")):
            balances = [b for b in balances if b.stock_status == "out_of_stock"]
        elif _truthy(p.get("low_stock")):
            balances = [b for b in balances if b.stock_status == "low"]
        if p.get("status"):
            balances = [b for b in balances if b.stock_status == p["status"]]

        serializer = InventoryBalanceSerializer(
            balances, many=True,
            context={"request": request, "include_valuation": self.can_view_valuation()},
        )
        return Response(serializer.data)


class InventorySummaryView(_TenantAPIView):
    required_permission = "inventory.view"

    def get(self, request):
        data = services.get_inventory_summary(self.company)
        return Response(InventorySummarySerializer(data).data)


class LowStockView(_TenantAPIView):
    required_permission = "inventory.view"

    def get(self, request):
        qs = (
            InventoryBalance.objects.select_related("product")
            .filter(company_id=request.user.company_id)
        )
        balances = [b for b in qs if b.stock_status in ("low", "out_of_stock")]
        serializer = InventoryBalanceSerializer(
            balances, many=True,
            context={"request": request, "include_valuation": self.can_view_valuation()},
        )
        return Response(serializer.data)


class ProductInventoryDetailView(_TenantAPIView):
    required_permission = "inventory.view"

    def get(self, request, product_id):
        balance = get_object_or_404(
            InventoryBalance.objects.select_related("product"),
            company_id=request.user.company_id, product_id=product_id,
        )
        include_valuation = self.can_view_valuation()
        recent = services.get_product_movement_history(self.company, balance.product)[:20]
        data = {
            "balance": balance,
            "recent_movements": recent,
            "estimated_fifo_value": (
                services.estimate_fifo_value(self.company, balance.product)
                if include_valuation else None
            ),
            "carton_weight_kg": balance.product.carton_weight_kg,
        }
        serializer = InventoryProductDetailSerializer(
            data, context={"request": request, "include_valuation": include_valuation}
        )
        return Response(serializer.data)


class ProductMovementsView(_TenantAPIView):
    required_permission = "inventory.view_movements"

    def get(self, request, product_id):
        get_object_or_404(
            InventoryBalance.objects,
            company_id=request.user.company_id, product_id=product_id,
        )
        qs = services.get_product_movement_history(self.company, product_id)
        return Response(StockMovementSerializer(qs, many=True).data)


class MovementListView(_TenantAPIView):
    required_permission = "inventory.view_movements"

    def get(self, request):
        qs = (
            StockMovement.objects.select_related("product", "created_by")
            .filter(company_id=request.user.company_id)
        )
        p = request.query_params
        if p.get("product"):
            qs = qs.filter(product_id=p["product"])
        if p.get("movement_type"):
            qs = qs.filter(movement_type=p["movement_type"])
        if p.get("reference_type"):
            qs = qs.filter(reference_type=p["reference_type"])
        if p.get("user"):
            qs = qs.filter(created_by_id=p["user"])
        if p.get("date_from"):
            qs = qs.filter(created_at__date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(created_at__date__lte=p["date_to"])
        return Response(StockMovementSerializer(qs, many=True).data)


class InventoryValuationView(_TenantAPIView):
    required_permission = VALUATION_PERMISSION

    def get(self, request):
        balances = (
            InventoryBalance.objects.select_related("product")
            .filter(company_id=request.user.company_id)
        )
        rows = []
        total = 0
        for balance in balances:
            value = services.estimate_fifo_value(self.company, balance.product)
            total += value
            rows.append({
                "product": balance.product_id,
                "product_name": balance.product.name_ar,
                "product_sku": balance.product.sku,
                "available_kg": balance.available_kg,
                "estimated_fifo_value": value,
            })
        return Response({
            "total_inventory_value": total,
            "lines": InventoryValuationSerializer(rows, many=True).data,
        })


class OpeningStockView(_TenantAPIView):
    required_permission = "inventory.adjust"

    def post(self, request):
        serializer = OpeningStockSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        movement = services.add_stock(
            company=self.company, product=vd["product"],
            cartons=vd["cartons"], pieces=vd["pieces"], kg=vd["kg"],
            unit_cost_per_kg=vd["unit_cost_per_kg"],
            source_type=services.StockSourceType.OPENING_INVENTORY,
            source_reference=vd.get("reference_number", ""),
            reason=vd["reason"], user=request.user, notes=vd.get("notes", ""),
        )
        return Response(
            StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED
        )


class StockAdjustmentViewSet(TenantScopedViewSet):
    queryset = StockAdjustment.objects.select_related("product", "applied_by").all()
    serializer_class = StockAdjustmentDetailSerializer
    http_method_names = ["get", "post", "head", "options"]
    permission_map = {
        "list": "inventory.view",
        "retrieve": "inventory.view",
        "create": "inventory.adjust",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("product"):
            qs = qs.filter(product_id=p["product"])
        if p.get("adjustment_type"):
            qs = qs.filter(adjustment_type=p["adjustment_type"])
        return qs

    def create(self, request, *args, **kwargs):
        serializer = StockAdjustmentCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        adjustment = services.apply_stock_adjustment(
            company=request.user.company, product=vd["product"],
            adjustment_type=vd["adjustment_type"], reason=vd["reason"],
            user=request.user,
            cartons=vd.get("cartons", 0), pieces=vd.get("pieces", 0), kg=vd.get("kg", 0),
            new_cartons=vd.get("new_cartons"), new_pieces=vd.get("new_pieces"),
            new_kg=vd.get("new_kg"), unit_cost_per_kg=vd.get("unit_cost_per_kg") or 0,
            notes=vd.get("notes", ""),
        )
        return Response(
            StockAdjustmentDetailSerializer(adjustment).data,
            status=status.HTTP_201_CREATED,
        )


class StocktakingViewSet(TenantScopedViewSet):
    queryset = StocktakingSession.objects.prefetch_related("lines", "lines__product").all()
    serializer_class = StocktakingSessionDetailSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "inventory.view",
        "retrieve": "inventory.view",
        "create": "inventory.stocktaking.create",
        "lines": "inventory.stocktaking.create",
        "line_detail": "inventory.stocktaking.create",
        "apply": "inventory.stocktaking.apply",
    }

    def get_serializer_class(self):
        if self.action == "list":
            return StocktakingSessionListSerializer
        return StocktakingSessionDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = StocktakingSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        session = services.create_stocktaking_session(
            company=request.user.company, count_date=vd.get("count_date"),
            reason=vd.get("reason", ""), notes=vd.get("notes", ""),
            user=request.user, generate_lines=vd.get("generate_lines", False),
        )
        return Response(
            StocktakingSessionDetailSerializer(session).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "post"])
    def lines(self, request, pk=None):
        session = self.get_object()
        if request.method == "GET":
            return Response(StocktakingLineSerializer(session.lines.all(), many=True).data)
        serializer = StocktakingLineCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        line = services.add_stocktaking_line(
            company=request.user.company, session=session, product=vd["product"],
            actual_cartons=vd["actual_cartons"], actual_pieces=vd["actual_pieces"],
            actual_kg=vd["actual_kg"], reason=vd.get("reason", ""),
            notes=vd.get("notes", ""), unit_cost_per_kg=vd.get("unit_cost_per_kg"),
        )
        return Response(StocktakingLineSerializer(line).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="lines/(?P<line_id>[^/.]+)")
    def line_detail(self, request, pk=None, line_id=None):
        session = self.get_object()
        line = get_object_or_404(
            StocktakingLine, pk=line_id, session=session,
            company_id=request.user.company_id,
        )
        line = services.update_stocktaking_line(line=line, **request.data)
        return Response(StocktakingLineSerializer(line).data)

    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        session = self.get_object()
        serializer = StocktakingApplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = services.apply_stocktaking_session(
            session=session, reason=serializer.validated_data["reason"], user=request.user
        )
        return Response(StocktakingSessionDetailSerializer(session).data)
