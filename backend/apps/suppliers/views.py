from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import TenantRole
from apps.audit.services import create_audit_log, record_action
from apps.core.viewsets import TenantScopedViewSet

from . import services
from .models import Supplier, SupplierAgreement, SupplierCategory, SupplierSpecialPrice
from .serializers import (
    OpeningBalanceUpdateSerializer,
    SupplierAgreementSerializer,
    SupplierCategorySerializer,
    SupplierCreateUpdateSerializer,
    SupplierDetailSerializer,
    SupplierLedgerEntrySerializer,
    SupplierListSerializer,
    SupplierSpecialPriceSerializer,
    SupplierStatementSerializer,
)


def _is_owner_admin(user):
    return user.role == TenantRole.OWNER_ADMIN


class SupplierCategoryViewSet(TenantScopedViewSet):
    queryset = SupplierCategory.objects.all()
    serializer_class = SupplierCategorySerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "suppliers.view",
        "retrieve": "suppliers.view",
        "create": "suppliers.create",
        "partial_update": "suppliers.create",
    }


class SupplierViewSet(TenantScopedViewSet):
    queryset = Supplier.objects.select_related("category").all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "suppliers.view",
        "retrieve": "suppliers.view",
        "create": "suppliers.create",
        "partial_update": "suppliers.edit",
        "disable": "suppliers.disable",
        "reactivate": "suppliers.disable",
        "ledger": "suppliers.view_balance",
        "statement": "suppliers.view_balance",
        "opening_balance": "suppliers.edit_opening_balance",
        "special_prices": "suppliers.special_prices.manage",
        "special_price_detail": "suppliers.special_prices.manage",
        "agreements": "suppliers.agreements.manage",
        "agreement_detail": "suppliers.agreements.manage",
    }

    def get_serializer_class(self):
        if self.action == "list":
            return SupplierListSerializer
        if self.action in ("create", "partial_update"):
            return SupplierCreateUpdateSerializer
        return SupplierDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("is_active") is not None:
            qs = qs.filter(is_active=p["is_active"].lower() in ("1", "true", "yes"))
        if p.get("category"):
            qs = qs.filter(category_id=p["category"])
        if p.get("category_code"):
            qs = qs.filter(category__code=p["category_code"])
        if p.get("supplier_type") or p.get("type"):
            qs = qs.filter(supplier_type=p.get("supplier_type") or p.get("type"))
        search = p.get("search") or p.get("q")
        if search:
            from django.db.models import Q

            qs = qs.filter(Q(name_ar__icontains=search) | Q(name_en__icontains=search) | Q(phone__icontains=search))
        if p.get("has_balance") in ("1", "true", "yes"):
            qs = qs.exclude(current_balance=0)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        supplier = services.create_supplier_with_opening_balance(
            company=request.user.company, created_by=request.user,
            **serializer.validated_data,
        )
        return Response(
            SupplierDetailSerializer(supplier, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def _detail_response(self, supplier):
        return Response(
            SupplierDetailSerializer(supplier, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        supplier = self.get_object()
        reason = (request.data.get("reason") or "").strip()
        if supplier.current_balance != 0:
            record_action(
                request=request, action="supplier_disable_with_balance",
                module="suppliers", reference_type="supplier", reference_id=supplier.id,
                previous_value={"current_balance": str(supplier.current_balance)},
                reason=reason,
            )
        else:
            create_audit_log(
                action="supplier_disable", user=request.user, company=request.user.company,
                module="suppliers", reference_type="supplier", reference_id=supplier.id,
                reason=reason, request=request,
            )
        supplier.is_active = False
        supplier.inactive_reason = reason
        supplier.save(update_fields=["is_active", "inactive_reason"])
        return self._detail_response(supplier)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        supplier = self.get_object()
        supplier.is_active = True
        supplier.inactive_reason = ""
        supplier.save(update_fields=["is_active", "inactive_reason"])
        return self._detail_response(supplier)

    @action(detail=True, methods=["get"])
    def ledger(self, request, pk=None):
        supplier = self.get_object()
        return Response(SupplierLedgerEntrySerializer(supplier.ledger_entries.all(), many=True).data)

    @action(detail=True, methods=["get"])
    def statement(self, request, pk=None):
        supplier = self.get_object()
        data = {
            "supplier_id": supplier.id,
            "supplier_name": supplier.name_ar,
            "opening_balance": supplier.opening_balance,
            "current_balance": services.get_supplier_balance(supplier),
            "balance_status": supplier.balance_status,
            "entries": supplier.ledger_entries.all(),
        }
        return Response(SupplierStatementSerializer(data).data)

    @action(detail=True, methods=["post"], url_path="opening-balance")
    def opening_balance(self, request, pk=None):
        supplier = self.get_object()
        serializer = OpeningBalanceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        previous = {
            "opening_balance": str(supplier.opening_balance),
            "opening_balance_type": supplier.opening_balance_type,
        }
        services.update_supplier_opening_balance_with_reason(
            supplier=supplier, new_amount=vd["opening_balance"],
            new_type=vd["opening_balance_type"], reason=vd["reason"], user=request.user,
        )
        record_action(
            request=request, action="edit_supplier_opening_balance", module="suppliers",
            reference_type="supplier", reference_id=supplier.id,
            previous_value=previous,
            new_value={"opening_balance": str(vd["opening_balance"]), "opening_balance_type": vd["opening_balance_type"]},
            reason=vd["reason"],
        )
        return self._detail_response(supplier)

    @action(detail=True, methods=["get", "post"], url_path="special-prices")
    def special_prices(self, request, pk=None):
        supplier = self.get_object()
        if request.method == "GET":
            qs = supplier.special_prices.select_related("product").all()
            return Response(SupplierSpecialPriceSerializer(qs, many=True).data)
        serializer = SupplierSpecialPriceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        reason = (request.data.get("reason") or "").strip()
        sp = services.create_supplier_special_price(
            company=request.user.company, supplier=supplier, product=vd["product"],
            price=vd["price"], price_type=vd["price_type"], reason=reason,
            notes=vd.get("notes", ""), created_by=request.user,
            allow_override=_is_owner_admin(request.user),
        )
        record_action(
            request=request, action="supplier_special_price_change", module="suppliers",
            reference_type="supplier_special_price", reference_id=sp.id,
            new_value={"product": sp.product_id, "price": str(sp.price), "price_type": sp.price_type},
            reason=reason,
        )
        return Response(SupplierSpecialPriceSerializer(sp).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="special-prices/(?P<price_id>[^/.]+)")
    def special_price_detail(self, request, pk=None, price_id=None):
        supplier = self.get_object()
        sp = get_object_or_404(SupplierSpecialPrice, pk=price_id, supplier=supplier,
                               company_id=request.user.company_id)
        reason = (request.data.get("reason") or "").strip()
        previous = {"price": str(sp.price), "is_active": sp.is_active}
        for field in ("price", "price_type", "is_active", "notes"):
            if field in request.data:
                setattr(sp, field, request.data[field])
        sp.updated_by = request.user
        sp.reason = reason or sp.reason
        sp.save()
        record_action(
            request=request, action="supplier_special_price_change", module="suppliers",
            reference_type="supplier_special_price", reference_id=sp.id,
            previous_value=previous, new_value={"price": str(sp.price), "is_active": sp.is_active},
            reason=reason,
        )
        return Response(SupplierSpecialPriceSerializer(sp).data)

    @action(detail=True, methods=["get", "post"], url_path="agreements")
    def agreements(self, request, pk=None):
        supplier = self.get_object()
        if request.method == "GET":
            return Response(SupplierAgreementSerializer(supplier.agreements.all(), many=True).data)
        serializer = SupplierAgreementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        reason = (request.data.get("reason") or "").strip()
        agreement = services.create_supplier_agreement(
            company=request.user.company, supplier=supplier,
            agreement_type=vd["agreement_type"], title=vd["title"],
            description=vd.get("description", ""), default_amount=vd.get("default_amount"),
            percentage=vd.get("percentage"),
            applies_automatically=vd.get("applies_automatically", False),
            suggestion_only=vd.get("suggestion_only", True), notes=vd.get("notes", ""),
            created_by=request.user,
        )
        self._audit_agreement(request, agreement, reason, previous=None)
        return Response(SupplierAgreementSerializer(agreement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="agreements/(?P<agreement_id>[^/.]+)")
    def agreement_detail(self, request, pk=None, agreement_id=None):
        supplier = self.get_object()
        agreement = get_object_or_404(SupplierAgreement, pk=agreement_id, supplier=supplier,
                                      company_id=request.user.company_id)
        previous = {
            "default_amount": str(agreement.default_amount),
            "percentage": str(agreement.percentage),
        }
        reason = (request.data.get("reason") or "").strip()
        for field in ("title", "description", "default_amount", "percentage",
                      "applies_automatically", "suggestion_only", "is_active", "notes"):
            if field in request.data:
                setattr(agreement, field, request.data[field])
        agreement.updated_by = request.user
        agreement.save()
        self._audit_agreement(request, agreement, reason, previous=previous)
        return Response(SupplierAgreementSerializer(agreement).data)

    def _audit_agreement(self, request, agreement, reason, previous):
        """Financial agreements require a reason; others are recorded silently."""
        if agreement.is_financial:
            record_action(
                request=request, action="supplier_agreement_change", module="suppliers",
                reference_type="supplier_agreement", reference_id=agreement.id,
                previous_value=previous,
                new_value={"default_amount": str(agreement.default_amount), "percentage": str(agreement.percentage)},
                reason=reason,
            )
        else:
            create_audit_log(
                action="supplier_agreement_change", user=request.user,
                company=request.user.company, module="suppliers",
                reference_type="supplier_agreement", reference_id=agreement.id,
                previous_value=previous, reason=reason, request=request,
                risk_level="low",
            )
