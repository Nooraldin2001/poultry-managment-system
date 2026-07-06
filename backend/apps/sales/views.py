"""Sales API (Phase 5) under /api/v1/tenant/sales/."""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasTenantPermission, IsTenantUser
from apps.core.viewsets import TenantScopedViewSet
from apps.customers.models import Customer
from apps.permissions.services import has_permission
from apps.products.models import Product

from . import services
from .models import (
    SalesInvoice,
    SalesInvoiceAdjustment,
    SalesInvoiceLine,
    SalesPriceSource,
    SalesStatus,
)
from .serializers import (
    SalesApproveSerializer,
    SalesCancelSerializer,
    SalesCollectionAdjustmentSerializer,
    SalesInvoiceAdjustmentSerializer,
    SalesInvoiceCreateUpdateSerializer,
    SalesInvoiceDetailSerializer,
    SalesInvoiceLineInputSerializer,
    SalesInvoiceLineSerializer,
    SalesInvoiceListSerializer,
    SalesPricePreviewSerializer,
    SalesStockCheckSerializer,
    SalesSummarySerializer,
)


def _truthy(value) -> bool:
    return str(value).lower() in ("1", "true", "yes")


def _require(user, code):
    if not has_permission(user, code):
        raise PermissionDenied(f"Missing permission: {code}")


def _require_draft(invoice):
    if invoice.status != SalesStatus.DRAFT:
        raise ValidationError("Only draft sales invoices can be edited.")


def _strip_cost_fields(data, user):
    if not has_permission(user, "sales.view_cost"):
        for key in ("fifo_cost_total", "fifo_cost_consumed", "posted_receivable"):
            data.pop(key, None)
        for line in data.get("lines", []):
            line.pop("fifo_cost_consumed", None)
    if not has_permission(user, "sales.view_profit"):
        data.pop("gross_profit", None)
        for line in data.get("lines", []):
            line.pop("gross_profit", None)
    return data


class SalesInvoiceViewSet(TenantScopedViewSet):
    queryset = (
        SalesInvoice.objects.select_related("customer")
        .prefetch_related("lines", "lines__product", "adjustments")
        .all()
    )
    serializer_class = SalesInvoiceDetailSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_map = {
        "list": "sales.view",
        "retrieve": "sales.view",
        "create": "sales.create",
        "partial_update": "sales.edit",
        "approve": "sales.approve",
        "cancel": "sales.cancel",
        "summary": "sales.view",
        "print_preview": "sales.print",
        "lines": "sales.view",
        "line_detail": "sales.edit",
        "adjustments": "sales.view",
        "adjustment_detail": "sales.apply_discount",
        "collection_adjustment": "sales.collection_adjustment",
        "price_preview": "sales.view",
        "price_history": "sales.view",
        "stock_check": "sales.view",
    }

    @property
    def company(self):
        return self.request.user.company

    def get_serializer_class(self):
        if self.action == "list":
            return SalesInvoiceListSerializer
        return SalesInvoiceDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("customer"):
            qs = qs.filter(customer_id=p["customer"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        elif self.action == "list" and not _truthy(p.get("include_cancelled")):
            # Cancelled invoices are audit records: hidden from the default
            # active list unless explicitly requested via ?status= or
            # ?include_cancelled=1. Detail/retrieve by ID still works.
            qs = qs.exclude(status=SalesStatus.CANCELLED)
        if p.get("payment_status"):
            qs = qs.filter(payment_status=p["payment_status"])
        if p.get("date_from"):
            qs = qs.filter(invoice_date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(invoice_date__lte=p["date_to"])
        if p.get("invoice_number"):
            qs = qs.filter(invoice_number__icontains=p["invoice_number"])
        if p.get("search"):
            qs = qs.filter(
                Q(invoice_number__icontains=p["search"])
                | Q(customer_name_snapshot__icontains=p["search"])
            )
        if _truthy(p.get("has_balance")):
            qs = qs.filter(balance_due__gt=0)
        if "vat_enabled" in p:
            if _truthy(p.get("vat_enabled")):
                qs = qs.filter(vat_rate__gt=0)
            else:
                qs = qs.filter(vat_rate=0)
        return qs

    def _detail_response(self, invoice, status_code=status.HTTP_200_OK):
        data = SalesInvoiceDetailSerializer(invoice).data
        data = _strip_cost_fields(data, self.request.user)
        return Response(data, status=status_code)

    def retrieve(self, request, *args, **kwargs):
        return self._detail_response(self.get_object())

    def create(self, request, *args, **kwargs):
        serializer = SalesInvoiceCreateUpdateSerializer(
            data=request.data, context={"company": self.company, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        invoice = services.create_sales_invoice(
            company=self.company,
            customer=vd["customer"],
            created_by=request.user,
            invoice_date=vd["invoice_date"],
            lines=vd.get("lines", []),
            adjustments=vd.get("adjustments", []),
            due_date=vd.get("due_date"),
            payment_method=vd.get("payment_method"),
            vat_rate=vd.get("vat_rate", 0),
            amount_paid=vd.get("amount_paid", 0),
            notes=vd.get("notes", ""),
        )
        return self._detail_response(invoice, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        from django.db import transaction

        invoice = self.get_object()
        _require_draft(invoice)
        serializer = SalesInvoiceCreateUpdateSerializer(
            data=request.data, partial=True,
            context={"company": self.company, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        with transaction.atomic():
            header_fields = []
            if "customer" in vd:
                customer = vd["customer"]
                invoice.customer = customer
                invoice.customer_name_snapshot = customer.name_ar
                invoice.customer_trn_snapshot = customer.trn or ""
                invoice.customer_phone_snapshot = customer.phone or ""
                invoice.customer_address_snapshot = customer.address or ""
                header_fields += [
                    "customer", "customer_name_snapshot", "customer_trn_snapshot",
                    "customer_phone_snapshot", "customer_address_snapshot",
                ]
            for field in (
                "invoice_date", "due_date", "payment_method",
                "vat_rate", "amount_paid", "notes",
            ):
                if field in vd:
                    setattr(invoice, field, vd[field])
                    header_fields.append(field)
            if header_fields:
                invoice.updated_by = request.user
                invoice.save(update_fields=list(set(header_fields)) + ["updated_by", "updated_at"])

            customer = invoice.customer
            if "lines" in vd:
                invoice.lines.all().delete()
                for index, line in enumerate(vd["lines"]):
                    services._create_line(
                        self.company, invoice, customer, line,
                        default_sort=index, user=request.user,
                    )
            if "adjustments" in vd:
                invoice.adjustments.all().delete()
                for adj in vd["adjustments"]:
                    services._create_adjustment(
                        self.company, invoice, adj, created_by=request.user
                    )

            services.recalculate_sales_invoice(invoice)

        invoice.refresh_from_db()
        return self._detail_response(invoice)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        invoice = self.get_object()
        serializer = SalesApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        credit_override = None
        if vd.get("credit_override"):
            credit_override = {"allowed": True, "reason": vd["reason"]}
        invoice = services.approve_sales_invoice(
            invoice=invoice, user=request.user,
            reason=vd["reason"], credit_override=credit_override,
        )
        return self._detail_response(invoice)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        serializer = SalesCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = services.cancel_sales_invoice(
            invoice=invoice, user=request.user,
            reason=serializer.validated_data["reason"],
        )
        return self._detail_response(invoice)

    @action(detail=True, methods=["post"], url_path="collection-adjustment")
    def collection_adjustment(self, request, pk=None):
        invoice = self.get_object()
        serializer = SalesCollectionAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        adj = services.create_collection_adjustment(
            invoice=invoice, user=request.user,
            amount=vd["amount"], reason=vd["reason"],
        )
        return Response(
            SalesInvoiceAdjustmentSerializer(adj).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        data = services.get_sales_summary(self.company)
        if not has_permission(request.user, "sales.view_profit"):
            data["gross_profit_estimate"] = 0
        return Response(SalesSummarySerializer(data).data)

    @action(detail=True, methods=["get"], url_path="print-preview")
    def print_preview(self, request, pk=None):
        invoice = self.get_object()
        return Response(services.build_print_preview(invoice, request=request))

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
        return Response(SalesPricePreviewSerializer(data).data)

    @action(detail=False, methods=["get"], url_path="price-history")
    def price_history(self, request):
        customer_id = request.query_params.get("customer")
        product_id = request.query_params.get("product")
        if not customer_id or not product_id:
            raise ValidationError("customer and product query params are required.")
        customer = get_object_or_404(
            Customer, pk=customer_id, company_id=self.company.id
        )
        product = get_object_or_404(
            Product, pk=product_id, company_id=self.company.id
        )
        return Response(services.get_sales_price_history(
            company=self.company, customer=customer, product=product,
        ))

    @action(detail=False, methods=["get"], url_path="stock-check")
    def stock_check(self, request):
        product_id = request.query_params.get("product")
        if not product_id:
            raise ValidationError("product query param is required.")
        product = get_object_or_404(
            Product, pk=product_id, company_id=self.company.id
        )
        data = services.check_stock_availability(
            company=self.company, product=product,
            cartons=request.query_params.get("cartons", 0),
            pieces=request.query_params.get("pieces", 0),
            kg=request.query_params.get("kg", 0),
        )
        return Response(SalesStockCheckSerializer(data).data)

    @action(detail=True, methods=["get", "post"])
    def lines(self, request, pk=None):
        invoice = self.get_object()
        if request.method == "GET":
            lines = SalesInvoiceLineSerializer(invoice.lines.all(), many=True).data
            if not has_permission(request.user, "sales.view_cost"):
                for line in lines:
                    line.pop("fifo_cost_consumed", None)
            if not has_permission(request.user, "sales.view_profit"):
                for line in lines:
                    line.pop("gross_profit", None)
            return Response(lines)
        _require(request.user, "sales.edit")
        _require_draft(invoice)
        serializer = SalesInvoiceLineInputSerializer(
            data=request.data, context={"company": self.company}
        )
        serializer.is_valid(raise_exception=True)
        line = services._create_line(
            self.company, invoice, invoice.customer,
            serializer.validated_data, user=request.user,
        )
        services.recalculate_sales_invoice(invoice)
        line.refresh_from_db()
        return Response(
            SalesInvoiceLineSerializer(line).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["patch", "delete"],
            url_path="lines/(?P<line_id>[^/.]+)")
    def line_detail(self, request, pk=None, line_id=None):
        invoice = self.get_object()
        _require_draft(invoice)
        line = get_object_or_404(
            SalesInvoiceLine, pk=line_id, invoice=invoice,
            company_id=self.company.id,
        )
        if request.method == "DELETE":
            line.delete()
            services.recalculate_sales_invoice(invoice)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = SalesInvoiceLineInputSerializer(
            data=request.data, partial=True, context={"company": self.company}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        if "product" in vd:
            product = vd["product"]
            line.product = product
            line.product_name_snapshot = product.name_ar if product else ""
            line.product_sku_snapshot = product.sku if product else ""
        # Price edits on an existing line are a manual override: they require
        # sales.override_price and are written to the audit log.
        new_price = vd.get("unit_price")
        price_changed = new_price is not None and new_price != line.unit_price
        if price_changed:
            _require(request.user, "sales.override_price")
            if new_price <= 0 and not vd.get("is_free", line.is_free):
                raise ValidationError(
                    {"unit_price": "Overridden price must be greater than zero."}
                )
            from apps.audit.services import create_audit_log

            create_audit_log(
                action="override_sales_price",
                user=request.user, company=self.company, module="sales",
                reference_type="sales_invoice", reference_id=invoice.id,
                reason=vd.get("override_reason", ""),
                previous_value={"unit_price": str(line.unit_price)},
                new_value={
                    "product_id": line.product_id,
                    "unit_price": str(new_price),
                },
            )
            line.price_source = SalesPriceSource.MANUAL_OVERRIDE
        for field in (
            "line_type", "quantity_cartons", "quantity_pieces", "quantity_kg",
            "unit_price", "price_type", "is_free", "free_reason",
            "discount_amount", "vat_rate", "notes", "sort_order",
        ):
            if field in vd:
                setattr(line, field, vd[field])
        line.save()
        services.recalculate_sales_invoice(invoice)
        line.refresh_from_db()
        return Response(SalesInvoiceLineSerializer(line).data)

    @action(detail=True, methods=["get", "post"])
    def adjustments(self, request, pk=None):
        invoice = self.get_object()
        if request.method == "GET":
            return Response(
                SalesInvoiceAdjustmentSerializer(invoice.adjustments.all(), many=True).data
            )
        _require(request.user, "sales.apply_discount")
        if invoice.status == SalesStatus.DRAFT:
            _require_draft(invoice)
        elif invoice.status not in (
            SalesStatus.APPROVED, SalesStatus.PARTIALLY_PAID, SalesStatus.PAID
        ):
            raise ValidationError("Adjustments not allowed for this invoice status.")
        serializer = SalesInvoiceAdjustmentSerializer(data=request.data)
        if invoice.status == SalesStatus.DRAFT:
            from .serializers import SalesAdjustmentInputSerializer
            serializer = SalesAdjustmentInputSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            adj = services._create_adjustment(
                self.company, invoice, serializer.validated_data,
                created_by=request.user,
            )
            services.recalculate_sales_invoice(invoice)
            return Response(
                SalesInvoiceAdjustmentSerializer(adj).data,
                status=status.HTTP_201_CREATED,
            )
        raise ValidationError(
            "Post-approval discounts use collection-adjustment endpoint."
        )

    @action(detail=True, methods=["patch", "delete"],
            url_path="adjustments/(?P<adjustment_id>[^/.]+)")
    def adjustment_detail(self, request, pk=None, adjustment_id=None):
        invoice = self.get_object()
        _require_draft(invoice)
        adj = get_object_or_404(
            SalesInvoiceAdjustment, pk=adjustment_id, invoice=invoice,
            company_id=self.company.id,
        )
        if request.method == "DELETE":
            adj.delete()
            services.recalculate_sales_invoice(invoice)
            return Response(status=status.HTTP_204_NO_CONTENT)
        from .serializers import SalesAdjustmentInputSerializer
        serializer = SalesAdjustmentInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        for field in ("adjustment_type", "effect", "title", "amount", "reason", "notes"):
            if field in vd:
                setattr(adj, field, vd[field])
        adj.save()
        services.recalculate_sales_invoice(invoice)
        return Response(SalesInvoiceAdjustmentSerializer(adj).data)


class CustomerSalesView(APIView):
    """GET /api/v1/tenant/customers/{customer_id}/sales/"""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "sales.view"

    def get(self, request, customer_id):
        customer = get_object_or_404(
            Customer, pk=customer_id, company_id=request.user.company_id
        )
        qs = services.get_customer_sales_history(request.user.company, customer)
        return Response(SalesInvoiceListSerializer(qs, many=True).data)
