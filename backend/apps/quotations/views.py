"""Quotations API (Phase 7) under /api/v1/tenant/quotations/."""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasTenantPermission, IsTenantUser
from apps.core.viewsets import TenantScopedViewSet
from apps.customers.models import Customer
from apps.permissions.services import has_permission
from apps.products.models import Product
from apps.sales.serializers import SalesInvoiceDetailSerializer

from . import services
from .models import Quotation, QuotationLine, QuotationStatus
from .serializers import (
    QuotationCancelSerializer,
    QuotationConvertToSalesSerializer,
    QuotationCreateUpdateSerializer,
    QuotationDetailSerializer,
    QuotationLineInputSerializer,
    QuotationLineSerializer,
    QuotationListSerializer,
    QuotationPricePreviewSerializer,
    QuotationRejectSerializer,
    QuotationStatusActionSerializer,
    QuotationStockWarningSerializer,
    QuotationSummarySerializer,
)


def _truthy(value) -> bool:
    return str(value).lower() in ("1", "true", "yes")


def _require(user, code):
    if not has_permission(user, code):
        raise PermissionDenied(f"Missing permission: {code}")


def _require_draft(quotation):
    if quotation.status != QuotationStatus.DRAFT:
        raise ValidationError("Only draft quotations can be edited.")


class QuotationViewSet(TenantScopedViewSet):
    queryset = (
        Quotation.objects.select_related("customer", "converted_sales_invoice")
        .prefetch_related("lines", "lines__product", "status_history")
        .all()
    )
    serializer_class = QuotationDetailSerializer
    # "delete" is needed so DELETE reaches the line sub-resource action;
    # deleting whole quotations stays blocked via destroy() below.
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    permission_map = {
        "list": "quotations.view",
        "retrieve": "quotations.view",
        "create": "quotations.create",
        "partial_update": "quotations.edit",
        "send": "quotations.send",
        "accept": "quotations.accept",
        "reject": "quotations.reject",
        "cancel": "quotations.cancel",
        "convert_to_sales": "quotations.convert_to_sales",
        "print_preview": "quotations.print",
        "stock_warning": "quotations.view",
        "lines": "quotations.view",
        "line_detail": "quotations.edit",
        "price_preview": "quotations.view",
        "expire_overdue": "quotations.send",
    }

    @property
    def company(self):
        return self.request.user.company

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            "DELETE", detail="Quotations cannot be deleted. Use cancel instead."
        )

    def get_serializer_class(self):
        if self.action == "list":
            return QuotationListSerializer
        return QuotationDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("customer"):
            qs = qs.filter(customer_id=p["customer"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("date_from"):
            qs = qs.filter(quotation_date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(quotation_date__lte=p["date_to"])
        if p.get("valid_until_from"):
            qs = qs.filter(valid_until__gte=p["valid_until_from"])
        if p.get("valid_until_to"):
            qs = qs.filter(valid_until__lte=p["valid_until_to"])
        if p.get("quotation_number"):
            qs = qs.filter(quotation_number__icontains=p["quotation_number"])
        if p.get("search"):
            qs = qs.filter(
                Q(quotation_number__icontains=p["search"])
                | Q(customer_name_snapshot__icontains=p["search"])
            )
        if "converted" in p:
            if _truthy(p.get("converted")):
                qs = qs.filter(status=QuotationStatus.CONVERTED)
            else:
                qs = qs.exclude(status=QuotationStatus.CONVERTED)
        if "expired" in p:
            if _truthy(p.get("expired")):
                qs = qs.filter(status=QuotationStatus.EXPIRED)
            else:
                qs = qs.exclude(status=QuotationStatus.EXPIRED)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = QuotationCreateUpdateSerializer(
            data=request.data, context={"company": self.company, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        quotation = services.create_quotation(
            company=self.company,
            customer=vd["customer"],
            created_by=request.user,
            quotation_date=vd["quotation_date"],
            valid_until=vd["valid_until"],
            lines=vd.get("lines", []),
            vat_rate=vd.get("vat_rate", 0),
            terms_and_conditions=vd.get("terms_and_conditions", ""),
            notes=vd.get("notes", ""),
            internal_notes=vd.get("internal_notes", ""),
        )
        return Response(
            QuotationDetailSerializer(quotation).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        from django.db import transaction

        quotation = self.get_object()
        _require_draft(quotation)
        serializer = QuotationCreateUpdateSerializer(
            data=request.data, partial=True,
            context={"company": self.company, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        with transaction.atomic():
            header_fields = []
            if "customer" in vd:
                customer = vd["customer"]
                quotation.customer = customer
                quotation.customer_name_snapshot = customer.name_ar
                quotation.customer_trn_snapshot = customer.trn or ""
                quotation.customer_phone_snapshot = customer.phone or ""
                quotation.customer_address_snapshot = customer.address or ""
                header_fields += [
                    "customer", "customer_name_snapshot", "customer_trn_snapshot",
                    "customer_phone_snapshot", "customer_address_snapshot",
                ]
            for field in (
                "quotation_date", "valid_until", "vat_rate",
                "terms_and_conditions", "notes", "internal_notes",
            ):
                if field in vd:
                    setattr(quotation, field, vd[field])
                    header_fields.append(field)
            if header_fields:
                quotation.updated_by = request.user
                quotation.save(update_fields=list(set(header_fields)) + ["updated_by", "updated_at"])

            customer = quotation.customer
            if "lines" in vd:
                quotation.lines.all().delete()
                for index, line in enumerate(vd["lines"]):
                    services._create_line(
                        self.company, quotation, customer, line,
                        default_sort=index, user=request.user,
                    )
            services.recalculate_quotation(quotation)

        quotation.refresh_from_db()
        return Response(QuotationDetailSerializer(quotation).data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        quotation = self.get_object()
        serializer = QuotationStatusActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quotation = services.send_quotation(
            quotation=quotation, user=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(QuotationDetailSerializer(quotation).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        quotation = self.get_object()
        serializer = QuotationStatusActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quotation = services.accept_quotation(
            quotation=quotation, user=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(QuotationDetailSerializer(quotation).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        quotation = self.get_object()
        serializer = QuotationRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quotation = services.reject_quotation(
            quotation=quotation, user=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(QuotationDetailSerializer(quotation).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        quotation = self.get_object()
        serializer = QuotationCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quotation = services.cancel_quotation(
            quotation=quotation, user=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(QuotationDetailSerializer(quotation).data)

    @action(detail=True, methods=["post"], url_path="convert-to-sales")
    def convert_to_sales(self, request, pk=None):
        quotation = self.get_object()
        serializer = QuotationConvertToSalesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quotation, invoice = services.convert_quotation_to_sales_draft(
            quotation=quotation, user=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response({
            "quotation": QuotationDetailSerializer(quotation).data,
            "sales_invoice": SalesInvoiceDetailSerializer(invoice).data,
        })

    @action(detail=True, methods=["get"], url_path="print-preview")
    def print_preview(self, request, pk=None):
        quotation = self.get_object()
        return Response(services.build_quotation_print_preview(quotation, request=request))

    @action(detail=True, methods=["get"], url_path="stock-warning")
    def stock_warning(self, request, pk=None):
        quotation = self.get_object()
        data = services.quotation_stock_warning(quotation)
        return Response(QuotationStockWarningSerializer(data, many=True).data)

    @action(detail=False, methods=["get"], url_path="price-preview")
    def price_preview(self, request):
        customer_id = request.query_params.get("customer")
        product_id = request.query_params.get("product")
        price_type = request.query_params.get("price_type", "kg")
        if not customer_id or not product_id:
            raise ValidationError("customer and product query params are required.")
        customer = get_object_or_404(
            Customer, pk=customer_id, company_id=self.company.id
        )
        product = get_object_or_404(
            Product, pk=product_id, company_id=self.company.id
        )
        data = services.price_preview(
            company=self.company, customer=customer,
            product=product, price_type=price_type,
        )
        return Response(QuotationPricePreviewSerializer(data).data)

    @action(detail=False, methods=["post"], url_path="expire-overdue")
    def expire_overdue(self, request):
        count = services.expire_quotations(company=self.company, user=request.user)
        return Response({"expired_count": count})

    @action(detail=True, methods=["get", "post"])
    def lines(self, request, pk=None):
        quotation = self.get_object()
        if request.method == "GET":
            return Response(
                QuotationLineSerializer(quotation.lines.all(), many=True).data
            )
        _require(request.user, "quotations.edit")
        _require_draft(quotation)
        serializer = QuotationLineInputSerializer(
            data=request.data, context={"company": self.company}
        )
        serializer.is_valid(raise_exception=True)
        line = services._create_line(
            self.company, quotation, quotation.customer,
            serializer.validated_data, user=request.user,
        )
        services.recalculate_quotation(quotation)
        line.refresh_from_db()
        return Response(
            QuotationLineSerializer(line).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["patch", "delete"],
            url_path="lines/(?P<line_id>[^/.]+)")
    def line_detail(self, request, pk=None, line_id=None):
        quotation = self.get_object()
        _require_draft(quotation)
        line = get_object_or_404(
            QuotationLine, pk=line_id, quotation=quotation,
            company_id=self.company.id,
        )
        if request.method == "DELETE":
            line.delete()
            services.recalculate_quotation(quotation)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = QuotationLineInputSerializer(
            data=request.data, partial=True, context={"company": self.company}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        if "product" in vd:
            product = vd["product"]
            line.product = product
            line.product_name_snapshot = product.name_ar if product else ""
            line.product_sku_snapshot = product.sku if product else ""
        for field in (
            "line_type", "quantity_cartons", "quantity_pieces", "quantity_kg",
            "unit_price", "price_type", "is_free", "free_reason",
            "discount_amount", "vat_rate", "notes", "sort_order",
        ):
            if field in vd:
                setattr(line, field, vd[field])
        line.save()
        services.recalculate_quotation(quotation)
        line.refresh_from_db()
        return Response(QuotationLineSerializer(line).data)


class QuotationSummaryView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "quotations.view"

    def get(self, request):
        data = services.get_quotation_summary(request.user.company)
        return Response(QuotationSummarySerializer(data).data)


class CustomerQuotationsView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "quotations.view"

    def get(self, request, customer_id):
        customer = get_object_or_404(
            Customer, pk=customer_id, company_id=request.user.company_id
        )
        qs = services.get_customer_quotation_history(request.user.company, customer)
        return Response(QuotationListSerializer(qs, many=True).data)
