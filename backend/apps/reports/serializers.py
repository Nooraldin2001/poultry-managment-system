"""Reports & analytics serializers (Phase 10)."""

from rest_framework import serializers

from apps.customers.models import Customer
from apps.products.models import Product
from apps.suppliers.models import Supplier

VALID_REPORT_TYPES = [
    "dashboard", "sales", "purchases", "inventory", "inventory_movements",
    "payments", "expenses", "profit", "tax_summary",
]

VALID_GROUP_BY = [
    "day", "week", "month", "customer", "supplier", "product", "category",
]


class ReportFilterSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    customer = serializers.IntegerField(required=False)
    supplier = serializers.IntegerField(required=False)
    product = serializers.IntegerField(required=False)
    category = serializers.IntegerField(required=False)
    payment_status = serializers.CharField(required=False)
    status = serializers.CharField(required=False)
    payment_method = serializers.CharField(required=False)
    movement_type = serializers.CharField(required=False)
    expense_scope = serializers.CharField(required=False)
    include_cancelled = serializers.BooleanField(required=False, default=False)
    include_drafts = serializers.BooleanField(required=False, default=False)
    group_by = serializers.ChoiceField(choices=VALID_GROUP_BY, required=False)

    def validate(self, attrs):
        df = attrs.get("date_from")
        dt = attrs.get("date_to")
        if df and dt and df > dt:
            raise serializers.ValidationError({"date_to": "Must be on or after date_from."})
        return attrs

    def validate_tenant_filters(self, company):
        """Reject cross-tenant filter IDs."""
        errors = {}
        if cid := self.validated_data.get("customer"):
            if not Customer.objects.filter(pk=cid, company=company).exists():
                errors["customer"] = "Customer not found in your company."
        if sid := self.validated_data.get("supplier"):
            if not Supplier.objects.filter(pk=sid, company=company).exists():
                errors["supplier"] = "Supplier not found in your company."
        if pid := self.validated_data.get("product"):
            if not Product.objects.filter(pk=pid, company=company).exists():
                errors["product"] = "Product not found in your company."
        if errors:
            raise serializers.ValidationError(errors)


class DashboardSummarySerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    total_sales = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_purchases = serializers.DecimalField(max_digits=16, decimal_places=2)
    gross_profit = serializers.DecimalField(max_digits=16, decimal_places=2)
    net_profit_foundation = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_expenses = serializers.DecimalField(max_digits=16, decimal_places=2)
    customer_receivables = serializers.DecimalField(max_digits=16, decimal_places=2)
    supplier_payables = serializers.DecimalField(max_digits=16, decimal_places=2)
    inventory_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    inventory_kg = serializers.DecimalField(max_digits=16, decimal_places=3)
    low_stock_count = serializers.IntegerField()
    overdue_customer_balance_count = serializers.IntegerField()
    overdue_supplier_payable_count = serializers.IntegerField()
    sales_invoice_count = serializers.IntegerField()
    purchase_invoice_count = serializers.IntegerField()
    quotations_open_count = serializers.IntegerField()
    pending_payments_count = serializers.IntegerField()
    tax_net_vat_estimate = serializers.DecimalField(
        max_digits=16, decimal_places=2, allow_null=True, required=False,
    )
    sales_trend = serializers.ListField()


class SalesReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()
    totals = serializers.DictField()
    breakdowns = serializers.DictField()


class PurchaseReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()
    totals = serializers.DictField()
    breakdowns = serializers.DictField()


class InventoryReportSerializer(serializers.Serializer):
    balances = serializers.ListField()
    totals = serializers.DictField()
    low_stock_products = serializers.ListField()
    out_of_stock_products = serializers.ListField()
    top_stock_value_products = serializers.ListField()
    chart_status = serializers.ListField()


class InventoryMovementReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()
    totals = serializers.DictField()
    breakdowns = serializers.DictField()


class CustomerStatementSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    customer_name = serializers.CharField()
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    opening_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    debit_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    credit_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    closing_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    ledger_entries = serializers.ListField()
    open_sales_invoices = serializers.ListField()
    aging_buckets = serializers.DictField()


class SupplierStatementSerializer(serializers.Serializer):
    supplier_id = serializers.IntegerField()
    supplier_name = serializers.CharField()
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    opening_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    debit_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    credit_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    closing_balance = serializers.DecimalField(max_digits=14, decimal_places=2)
    ledger_entries = serializers.ListField()
    open_purchase_invoices = serializers.ListField()
    aging_buckets = serializers.DictField()


class AgingReportSerializer(serializers.Serializer):
    as_of = serializers.CharField()
    customers = serializers.ListField(required=False)
    suppliers = serializers.ListField(required=False)


class PaymentsReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()
    totals = serializers.DictField()
    breakdowns = serializers.DictField()


class ExpensesReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    records = serializers.ListField()
    totals = serializers.DictField()
    breakdowns = serializers.DictField()
    chart_categories = serializers.ListField()


class ProfitReportSerializer(serializers.Serializer):
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    sales_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    fifo_cost_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    gross_profit = serializers.DecimalField(max_digits=16, decimal_places=2)
    expenses_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    net_profit_foundation = serializers.DecimalField(max_digits=16, decimal_places=2)
    gross_margin_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    net_margin_percentage = serializers.DecimalField(max_digits=8, decimal_places=2)
    profit_by_day = serializers.ListField()
    profit_by_customer = serializers.ListField()
    profit_by_product = serializers.ListField()
    note = serializers.CharField()


class TaxSummaryBridgeSerializer(serializers.Serializer):
    available = serializers.BooleanField(required=False)
    message = serializers.CharField(required=False)
    output_vat = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False,
    )
    input_vat = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False,
    )
    net_vat = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False,
    )
    payable_or_recoverable = serializers.CharField(required=False)
    warning_count = serializers.IntegerField(required=False)
    disabled_vat_count = serializers.IntegerField(required=False)
    note = serializers.CharField(required=False)


class ExportPayloadQuerySerializer(serializers.Serializer):
    report_type = serializers.ChoiceField(choices=VALID_REPORT_TYPES)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    customer = serializers.IntegerField(required=False)
    supplier = serializers.IntegerField(required=False)
    product = serializers.IntegerField(required=False)
    category = serializers.IntegerField(required=False)
    payment_status = serializers.CharField(required=False)
    status = serializers.CharField(required=False)
    payment_method = serializers.CharField(required=False)
    movement_type = serializers.CharField(required=False)
    expense_scope = serializers.CharField(required=False)
    include_cancelled = serializers.BooleanField(required=False, default=False)
    include_drafts = serializers.BooleanField(required=False, default=False)


class ExportPayloadSerializer(serializers.Serializer):
    metadata = serializers.DictField()
    company = serializers.DictField()
    date_from = serializers.CharField()
    date_to = serializers.CharField()
    filters = serializers.DictField()
    report = serializers.DictField()
