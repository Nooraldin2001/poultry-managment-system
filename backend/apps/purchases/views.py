"""Purchases API (Phase 4) under /api/v1/tenant/purchases/.

Business logic is delegated to ``services``; views handle permission gating,
(de)serialization and tenant scoping. Sub-resources (lines/adjustments) are
editable only while the invoice is a draft.
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasTenantPermission, IsTenantUser
from apps.core.viewsets import TenantScopedViewSet
from apps.permissions.services import has_permission

from . import services
from .models import (
    PurchaseAdjustment,
    PurchaseInvoice,
    PurchaseInvoiceLine,
    PurchaseStatus,
)
from .serializers import (
    PurchaseAdjustmentInputSerializer,
    PurchaseAdjustmentSerializer,
    PurchaseApproveSerializer,
    PurchaseAttachmentCreateSerializer,
    PurchaseAttachmentSerializer,
    PurchaseCancelSerializer,
    PurchaseInvoiceCreateUpdateSerializer,
    PurchaseInvoiceDetailSerializer,
    PurchaseInvoiceLineInputSerializer,
    PurchaseInvoiceLineSerializer,
    PurchaseInvoiceListSerializer,
    PurchaseSummarySerializer,
)


def _truthy(value) -> bool:
    return str(value).lower() in ("1", "true", "yes")


def _require(user, code):
    if not has_permission(user, code):
        raise PermissionDenied(f"Missing permission: {code}")


def _require_draft(invoice):
    if invoice.status != PurchaseStatus.DRAFT:
        raise ValidationError("Only draft purchase invoices can be edited.")


class PurchaseInvoiceViewSet(TenantScopedViewSet):
    queryset = (
        PurchaseInvoice.objects.select_related("supplier")
        .prefetch_related("lines", "lines__product", "adjustments", "attachments")
        .all()
    )
    serializer_class = PurchaseInvoiceDetailSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    permission_map = {
        "list": "purchases.view",
        "retrieve": "purchases.view",
        "create": "purchases.create",
        "partial_update": "purchases.edit",
        "approve": "purchases.approve",
        "cancel": "purchases.cancel",
        "summary": "purchases.view",
        "print_preview": "purchases.print",
        "lines": "purchases.view",
        "line_detail": "purchases.edit",
        "adjustments": "purchases.view",
        "adjustment_detail": "purchases.manage_adjustments",
        "attachments": "purchases.view",
        "price_history": "purchases.view",
    }

    @property
    def company(self):
        return self.request.user.company

    def get_serializer_class(self):
        if self.action == "list":
            return PurchaseInvoiceListSerializer
        return PurchaseInvoiceDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("supplier"):
            qs = qs.filter(supplier_id=p["supplier"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        elif not _truthy(p.get("include_cancelled")):
            # Cancelled invoices are audit records: hidden from the default
            # active list unless explicitly requested via ?status= or
            # ?include_cancelled=1.
            qs = qs.exclude(status=PurchaseStatus.CANCELLED)
        if p.get("payment_status"):
            qs = qs.filter(payment_status=p["payment_status"])
        if p.get("date_from"):
            qs = qs.filter(invoice_date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(invoice_date__lte=p["date_to"])
        if p.get("supplier_invoice_number"):
            qs = qs.filter(supplier_invoice_number__icontains=p["supplier_invoice_number"])
        if p.get("search"):
            qs = qs.filter(
                Q(invoice_number__icontains=p["search"])
                | Q(supplier_invoice_number__icontains=p["search"])
                | Q(supplier_name_snapshot__icontains=p["search"])
            )
        if _truthy(p.get("has_balance")):
            qs = qs.filter(balance_due__gt=0)
        if "vat_enabled" in p:
            if _truthy(p.get("vat_enabled")):
                qs = qs.filter(vat_rate__gt=0)
            else:
                qs = qs.filter(vat_rate=0)
        return qs

    # --- Create / update --------------------------------------------------
    def create(self, request, *args, **kwargs):
        serializer = PurchaseInvoiceCreateUpdateSerializer(
            data=request.data, context={"company": self.company, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        invoice = services.create_purchase_invoice(
            company=self.company,
            supplier=vd["supplier"],
            created_by=request.user,
            invoice_date=vd["invoice_date"],
            lines=vd.get("lines", []),
            adjustments=vd.get("adjustments", []),
            supplier_invoice_number=vd.get("supplier_invoice_number", ""),
            due_date=vd.get("due_date"),
            payment_method=vd.get("payment_method"),
            vat_rate=vd.get("vat_rate", 0),
            amount_paid=vd.get("amount_paid", 0),
            notes=vd.get("notes", ""),
            money_account=vd.get("money_account"),
            backdate_reason=vd.get("backdate_reason", ""),
        )
        from apps.core.document_dates import log_backdated_invoice

        log_backdated_invoice(
            user=request.user,
            company=self.company,
            module="purchases",
            reference_type="purchase_invoice",
            invoice_id=invoice.id,
            invoice_date=invoice.invoice_date,
            backdate_reason=invoice.backdate_reason,
            created_at=invoice.created_at,
        )
        return Response(
            PurchaseInvoiceDetailSerializer(invoice).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        from django.db import transaction

        invoice = self.get_object()
        _require_draft(invoice)
        serializer = PurchaseInvoiceCreateUpdateSerializer(
            data=request.data, partial=True,
            context={"company": self.company, "request": request, "instance": invoice},
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        with transaction.atomic():
            header_fields = []
            if "supplier" in vd:
                invoice.supplier = vd["supplier"]
                invoice.supplier_name_snapshot = vd["supplier"].name_ar
                invoice.supplier_trn_snapshot = vd["supplier"].trn or ""
                header_fields += ["supplier", "supplier_name_snapshot", "supplier_trn_snapshot"]
            for field in ("invoice_date", "due_date", "supplier_invoice_number",
                          "payment_method", "vat_rate", "amount_paid", "notes",
                          "money_account", "backdate_reason"):
                if field in vd:
                    setattr(invoice, field, vd[field])
                    header_fields.append(field)
            if header_fields:
                invoice.updated_by = request.user
                invoice.save(update_fields=list(set(header_fields)) + ["updated_by", "updated_at"])

            if "lines" in vd:
                invoice.lines.all().delete()
                for index, line in enumerate(vd["lines"]):
                    services._create_line(
                        self.company, invoice, line,
                        default_sort=index, user=request.user,
                    )
            if "adjustments" in vd:
                invoice.adjustments.all().delete()
                for adj in vd["adjustments"]:
                    services._create_adjustment(self.company, invoice, adj, created_by=request.user)

            services.recalculate_purchase_invoice(invoice)

        invoice.refresh_from_db()
        if "invoice_date" in vd:
            from apps.core.document_dates import log_backdated_invoice

            log_backdated_invoice(
                user=request.user,
                company=self.company,
                module="purchases",
                reference_type="purchase_invoice",
                invoice_id=invoice.id,
                invoice_date=invoice.invoice_date,
                backdate_reason=invoice.backdate_reason,
                created_at=invoice.created_at,
            )
        return Response(PurchaseInvoiceDetailSerializer(invoice).data)

    # --- Workflow actions -------------------------------------------------
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        invoice = self.get_object()
        serializer = PurchaseApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = services.approve_purchase_invoice(
            invoice=invoice, user=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(PurchaseInvoiceDetailSerializer(invoice).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        serializer = PurchaseCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = services.cancel_purchase_invoice(
            invoice=invoice, user=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(PurchaseInvoiceDetailSerializer(invoice).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        data = services.get_purchase_summary(self.company)
        return Response(PurchaseSummarySerializer(data).data)

    @action(detail=True, methods=["get"], url_path="print-preview")
    def print_preview(self, request, pk=None):
        invoice = self.get_object()
        return Response(services.build_purchase_print_preview(invoice, request=request))

    @action(detail=False, methods=["get"], url_path="price-history")
    def price_history(self, request):
        from apps.products.models import Product
        from apps.suppliers.models import Supplier

        supplier_id = request.query_params.get("supplier")
        product_id = request.query_params.get("product")
        if not supplier_id or not product_id:
            raise ValidationError("supplier and product query params are required.")
        supplier = get_object_or_404(
            Supplier, pk=supplier_id, company_id=self.company.id
        )
        product = get_object_or_404(
            Product, pk=product_id, company_id=self.company.id
        )
        return Response(services.get_purchase_price_history(
            company=self.company, supplier=supplier, product=product,
        ))

    # --- Lines sub-resource ----------------------------------------------
    @action(detail=True, methods=["get", "post"])
    def lines(self, request, pk=None):
        invoice = self.get_object()
        if request.method == "GET":
            return Response(
                PurchaseInvoiceLineSerializer(invoice.lines.all(), many=True).data
            )
        _require(request.user, "purchases.edit")
        _require_draft(invoice)
        serializer = PurchaseInvoiceLineInputSerializer(
            data=request.data, context={"company": self.company}
        )
        serializer.is_valid(raise_exception=True)
        line = services._create_line(
            self.company, invoice, serializer.validated_data, user=request.user
        )
        services.recalculate_purchase_invoice(invoice)
        line.refresh_from_db()
        return Response(
            PurchaseInvoiceLineSerializer(line).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["patch", "delete"],
            url_path="lines/(?P<line_id>[^/.]+)")
    def line_detail(self, request, pk=None, line_id=None):
        invoice = self.get_object()
        _require_draft(invoice)
        line = get_object_or_404(
            PurchaseInvoiceLine, pk=line_id, invoice=invoice,
            company_id=self.company.id,
        )
        if request.method == "DELETE":
            line.delete()
            services.recalculate_purchase_invoice(invoice)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = PurchaseInvoiceLineInputSerializer(
            data=request.data, partial=True, context={"company": self.company}
        )
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        if "product" in vd:
            line.product = vd["product"]
            line.product_name_snapshot = vd["product"].name_ar if vd["product"] else ""
            line.product_sku_snapshot = vd["product"].sku if vd["product"] else ""
        # Changing the stored price on an existing line is a manual override:
        # permission-gated and audit-logged.
        new_price = vd.get("unit_price")
        if new_price is not None and new_price != line.unit_price:
            _require(request.user, "purchases.override_price")
            if new_price <= 0:
                raise ValidationError(
                    {"unit_price": "Overridden purchase price must be greater than zero."}
                )
            from apps.audit.services import create_audit_log

            create_audit_log(
                action="override_purchase_price",
                user=request.user, company=self.company, module="purchases",
                reference_type="purchase_invoice", reference_id=invoice.id,
                reason=vd.get("override_reason", ""),
                previous_value={"unit_price": str(line.unit_price)},
                new_value={
                    "product_id": line.product_id,
                    "unit_price": str(new_price),
                },
            )
        for field in ("line_type", "quantity_cartons", "quantity_pieces",
                      "quantity_kg", "price_type", "vat_rate",
                      "notes", "sort_order"):
            if field in vd:
                setattr(line, field, vd[field])
        if new_price is not None:
            line.unit_price = new_price
        line.save()
        services.recalculate_purchase_invoice(invoice)
        line.refresh_from_db()
        return Response(PurchaseInvoiceLineSerializer(line).data)

    # --- Adjustments sub-resource ----------------------------------------
    @action(detail=True, methods=["get", "post"])
    def adjustments(self, request, pk=None):
        invoice = self.get_object()
        if request.method == "GET":
            return Response(
                PurchaseAdjustmentSerializer(invoice.adjustments.all(), many=True).data
            )
        _require(request.user, "purchases.manage_adjustments")
        _require_draft(invoice)
        serializer = PurchaseAdjustmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        adj = services._create_adjustment(
            self.company, invoice, serializer.validated_data, created_by=request.user
        )
        services.recalculate_purchase_invoice(invoice)
        return Response(
            PurchaseAdjustmentSerializer(adj).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["patch", "delete"],
            url_path="adjustments/(?P<adjustment_id>[^/.]+)")
    def adjustment_detail(self, request, pk=None, adjustment_id=None):
        invoice = self.get_object()
        _require_draft(invoice)
        adj = get_object_or_404(
            PurchaseAdjustment, pk=adjustment_id, invoice=invoice,
            company_id=self.company.id,
        )
        if request.method == "DELETE":
            adj.delete()
            services.recalculate_purchase_invoice(invoice)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = PurchaseAdjustmentInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        from . import calculations as calc

        for field in ("adjustment_type", "effect", "title", "amount", "vat_rate", "notes"):
            if field in vd:
                setattr(adj, field, vd[field])
        adj.vat_amount = calc.vat_amount(adj.amount, adj.vat_rate)
        adj.save()
        services.recalculate_purchase_invoice(invoice)
        return Response(PurchaseAdjustmentSerializer(adj).data)

    # --- Attachments sub-resource ----------------------------------------
    @action(detail=True, methods=["get", "post"])
    def attachments(self, request, pk=None):
        invoice = self.get_object()
        if request.method == "GET":
            return Response(
                PurchaseAttachmentSerializer(invoice.attachments.all(), many=True).data
            )
        _require(request.user, "purchases.upload_attachment")
        serializer = PurchaseAttachmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data
        attachment = services.create_purchase_attachment(
            invoice=invoice, file=vd["file"],
            file_type=vd.get("file_type", "supplier_invoice"),
            notes=vd.get("notes", ""), user=request.user,
        )
        return Response(
            PurchaseAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class SupplierPurchasesView(APIView):
    """GET /api/v1/tenant/suppliers/{supplier_id}/purchases/ — supplier history."""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "purchases.view"

    def get(self, request, supplier_id):
        from apps.suppliers.models import Supplier

        supplier = get_object_or_404(
            Supplier, pk=supplier_id, company_id=request.user.company_id
        )
        qs = services.get_supplier_purchase_history(request.user.company, supplier)
        return Response(PurchaseInvoiceListSerializer(qs, many=True).data)
