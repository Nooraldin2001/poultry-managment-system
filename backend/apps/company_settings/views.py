from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_action, require_reason_for_sensitive_action
from apps.core.permissions import HasTenantPermission, IsTenantUser

from .invoice_design import TEMPLATE_CATALOG, THEME_CATALOG
from .models import NumberingSettings, PrintTemplateSettings, VATSettings
from .serializers import (
    InvoiceDesignSettingsSerializer,
    NumberingSettingsSerializer,
    PrintTemplateSettingsSerializer,
    VATSettingsSerializer,
)
from .services import get_invoice_design


class _TenantScopedMixin:
    permission_classes = [IsTenantUser, HasTenantPermission]

    def get_queryset(self):
        return self.model.objects.filter(company_id=self.request.user.company_id)


class VATSettingsView(APIView):
    permission_classes = [IsTenantUser, HasTenantPermission]

    # Checked by HasTenantPermission; view-level read vs manage.
    @property
    def required_permission(self):
        return "settings.view" if self.request.method == "GET" else "settings.manage"

    def _get_settings(self, request):
        obj, _ = VATSettings.objects.get_or_create(company=request.user.company)
        return obj

    def get(self, request):
        return Response(VATSettingsSerializer(self._get_settings(request)).data)

    def patch(self, request):
        obj = self._get_settings(request)
        serializer = VATSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        rate_changed = (
            "default_vat_rate" in data
            and data["default_vat_rate"] != obj.default_vat_rate
        )
        disabled = (
            "vat_enabled_default" in data
            and data["vat_enabled_default"] is False
            and obj.vat_enabled_default is True
        )
        action = None
        if disabled:
            action = "vat_disabled"
        elif rate_changed:
            action = "vat_rate_change"

        reason = request.data.get("reason", "")
        if action and obj.require_reason_for_vat_change:
            reason = require_reason_for_sensitive_action(action, reason)

        previous = VATSettingsSerializer(obj).data
        serializer.save()

        if action:
            record_action(
                request=request,
                action=action,
                module="tax",
                reference_type="vat_settings",
                reference_id=obj.id,
                reason=reason,
                previous_value=previous,
                new_value=VATSettingsSerializer(obj).data,
            )
        return Response(VATSettingsSerializer(obj).data)


class NumberingListView(_TenantScopedMixin, generics.ListAPIView):
    model = NumberingSettings
    serializer_class = NumberingSettingsSerializer
    pagination_class = None
    required_permission = "settings.view"


class NumberingUpdateView(_TenantScopedMixin, generics.RetrieveUpdateAPIView):
    model = NumberingSettings
    serializer_class = NumberingSettingsSerializer
    required_permission = "settings.manage"

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        previous = NumberingSettingsSerializer(obj).data
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        # Editing numbering is a sensitive action.
        reason = require_reason_for_sensitive_action(
            "numbering_change", request.data.get("reason", "")
        )
        serializer.save()
        record_action(
            request=request,
            action="numbering_change",
            module="settings",
            reference_type="numbering_settings",
            reference_id=obj.id,
            reason=reason,
            previous_value=previous,
            new_value=NumberingSettingsSerializer(obj).data,
        )
        return Response(NumberingSettingsSerializer(obj).data)


class InvoiceDesignSettingsView(APIView):
    """Company-level invoice template + color theme (GET/PATCH)."""

    permission_classes = [IsTenantUser, HasTenantPermission]

    @property
    def required_permission(self):
        return "settings.view" if self.request.method == "GET" else "settings.manage"

    def get(self, request):
        obj = get_invoice_design(request.user.company)
        return Response(InvoiceDesignSettingsSerializer(obj).data)

    def patch(self, request):
        obj = get_invoice_design(request.user.company)
        previous = InvoiceDesignSettingsSerializer(obj).data
        serializer = InvoiceDesignSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_action(
            request=request,
            action="invoice_design_change",
            module="settings",
            reference_type="invoice_design",
            reference_id=obj.id,
            reason=request.data.get("reason", ""),
            previous_value=previous,
            new_value=InvoiceDesignSettingsSerializer(obj).data,
        )
        return Response(InvoiceDesignSettingsSerializer(obj).data)


class InvoiceDesignCatalogView(APIView):
    """Available invoice templates + color themes (read-only)."""

    permission_classes = [IsTenantUser, HasTenantPermission]
    required_permission = "settings.view"

    def get(self, request):
        return Response({"templates": TEMPLATE_CATALOG, "themes": THEME_CATALOG})


class PrintTemplateListView(_TenantScopedMixin, generics.ListAPIView):
    model = PrintTemplateSettings
    serializer_class = PrintTemplateSettingsSerializer
    pagination_class = None
    required_permission = "settings.view"


class PrintTemplateUpdateView(_TenantScopedMixin, generics.RetrieveUpdateAPIView):
    model = PrintTemplateSettings
    serializer_class = PrintTemplateSettingsSerializer
    required_permission = "settings.manage"

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        previous = PrintTemplateSettingsSerializer(obj).data
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        reason = require_reason_for_sensitive_action(
            "print_template_change", request.data.get("reason", "")
        )
        serializer.save()
        record_action(
            request=request,
            action="print_template_change",
            module="settings",
            reference_type="print_template",
            reference_id=obj.id,
            reason=reason,
            previous_value=previous,
            new_value=PrintTemplateSettingsSerializer(obj).data,
        )
        return Response(PrintTemplateSettingsSerializer(obj).data)
