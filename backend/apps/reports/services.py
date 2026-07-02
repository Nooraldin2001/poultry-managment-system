"""Reports & analytics services (Phase 10).

All reports are computed from real tenant transaction data — no mock/fake values.
"""

from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.constants import risk_for_action
from apps.audit.services import create_audit_log
from apps.customers.models import Customer
from apps.customers.services import get_customer_balance
from apps.expenses.models import Expense, ExpenseStatus, PurchaseLinkBehavior
from apps.expenses.services import get_expense_summary
from apps.inventory.models import InventoryBalance, MovementDirection, StockMovement
from apps.inventory.services import estimate_fifo_value, get_inventory_summary
from apps.payments.models import PaymentMovement, PaymentMovementStatus, PaymentMovementType
from apps.purchases.models import PurchaseInvoice, PurchaseStatus
from apps.quotations.models import Quotation, QuotationStatus
from apps.sales.models import SalesInvoice, SalesInvoiceLine, SalesStatus
from apps.suppliers.models import Supplier
from apps.suppliers.services import get_supplier_balance

ZERO = Decimal("0")

SALES_ACTIVE = [SalesStatus.APPROVED, SalesStatus.PARTIALLY_PAID, SalesStatus.PAID]
PURCHASE_ACTIVE = [PurchaseStatus.APPROVED, PurchaseStatus.PARTIALLY_PAID, PurchaseStatus.PAID]


def _d(v) -> Decimal:
    return Decimal(str(v)) if v is not None else ZERO


def _parse_dates(date_from=None, date_to=None):
    today = timezone.now().date()
    if isinstance(date_from, str) and date_from:
        date_from = date.fromisoformat(date_from)
    if isinstance(date_to, str) and date_to:
        date_to = date.fromisoformat(date_to)
    date_from = date_from or today.replace(day=1)
    date_to = date_to or today
    if date_from > date_to:
        raise ValidationError({"date_to": "date_to must be on or after date_from."})
    return date_from, date_to


def _sales_qs(company, date_from, date_to, *, include_draft=False, include_cancelled=False):
    qs = SalesInvoice.objects.filter(
        company=company, invoice_date__gte=date_from, invoice_date__lte=date_to,
    )
    if not include_cancelled:
        qs = qs.exclude(status=SalesStatus.CANCELLED)
    if not include_draft:
        qs = qs.filter(status__in=SALES_ACTIVE)
    return qs


def _purchase_qs(company, date_from, date_to, *, include_draft=False, include_cancelled=False):
    qs = PurchaseInvoice.objects.filter(
        company=company, invoice_date__gte=date_from, invoice_date__lte=date_to,
    )
    if not include_cancelled:
        qs = qs.exclude(status=PurchaseStatus.CANCELLED)
    if not include_draft:
        qs = qs.filter(status__in=PURCHASE_ACTIVE)
    return qs


def _expense_qs(company, date_from, date_to, *, include_cancelled=False):
    qs = Expense.objects.filter(
        company=company, expense_date__gte=date_from, expense_date__lte=date_to,
        status=ExpenseStatus.POSTED,
    ).exclude(
        purchase_link_behavior__in=[
            PurchaseLinkBehavior.REDUCE_SUPPLIER_PAYABLE,
            PurchaseLinkBehavior.INCREASE_INVENTORY_COST,
        ]
    )
    if include_cancelled:
        qs = Expense.objects.filter(company=company, expense_date__gte=date_from, expense_date__lte=date_to)
    return qs


def _payments_qs(company, date_from, date_to, *, include_cancelled=False):
    qs = PaymentMovement.objects.filter(
        company=company, movement_date__gte=date_from, movement_date__lte=date_to,
    )
    if not include_cancelled:
        qs = qs.filter(status=PaymentMovementStatus.POSTED)
    return qs


def _sales_trend(company, date_from, date_to) -> list:
    qs = _sales_qs(company, date_from, date_to)
    by_day = defaultdict(lambda: {"sales": ZERO, "gross_profit": ZERO})
    for row in qs.values("invoice_date").annotate(
        sales=Sum("total_amount"), gross_profit=Sum("gross_profit"),
    ):
        d = str(row["invoice_date"])
        by_day[d]["sales"] = row["sales"] or ZERO
        by_day[d]["gross_profit"] = row["gross_profit"] or ZERO
    return [
        {"date": d, "sales": str(by_day[d]["sales"]), "gross_profit": str(by_day[d]["gross_profit"])}
        for d in sorted(by_day.keys())
    ]


def _aging_buckets(open_items, *, today, date_field="invoice_date", amount_field="balance_due"):
    buckets = {
        "current": ZERO, "1_30_days": ZERO, "31_60_days": ZERO,
        "61_90_days": ZERO, "over_90_days": ZERO,
    }
    for item in open_items:
        amt = _d(getattr(item, amount_field, ZERO))
        if amt <= 0:
            continue
        ref = getattr(item, date_field, None) or getattr(item, "due_date", None) or today
        days = (today - ref).days
        if days <= 0:
            buckets["current"] += amt
        elif days <= 30:
            buckets["1_30_days"] += amt
        elif days <= 60:
            buckets["31_60_days"] += amt
        elif days <= 90:
            buckets["61_90_days"] += amt
        else:
            buckets["over_90_days"] += amt
    return {k: str(v.quantize(Decimal("0.01"))) for k, v in buckets.items()}


def get_dashboard_summary(company, *, date_from=None, date_to=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    today = timezone.now().date()

    sales_qs = _sales_qs(company, date_from, date_to)
    purchase_qs = _purchase_qs(company, date_from, date_to)
    expense_qs = _expense_qs(company, date_from, date_to)

    sales_agg = sales_qs.aggregate(
        total=Sum("total_amount"), gp=Sum("gross_profit"), vat=Sum("vat_amount"),
    )
    purchase_agg = purchase_qs.aggregate(total=Sum("total_amount"))
    expense_agg = expense_qs.aggregate(total=Sum("total_amount"))

    inv = get_inventory_summary(company)
    gross_profit = sales_agg["gp"] or ZERO
    expenses_total = expense_agg["total"] or ZERO
    net_profit = gross_profit - expenses_total

    tax_net = None
    try:
        from apps.tax.services import get_net_vat_estimate
        tax_net = get_net_vat_estimate(company, date_from=date_from, date_to=date_to)["net_vat"]
    except Exception:
        tax_net = None

    return {
        "date_from": str(date_from),
        "date_to": str(date_to),
        "total_sales": sales_agg["total"] or ZERO,
        "total_purchases": purchase_agg["total"] or ZERO,
        "gross_profit": gross_profit,
        "net_profit_foundation": net_profit,
        "total_expenses": expenses_total,
        "customer_receivables": Customer.objects.filter(
            company=company, current_balance__gt=0,
        ).aggregate(s=Sum("current_balance"))["s"] or ZERO,
        "supplier_payables": Supplier.objects.filter(
            company=company, current_balance__gt=0,
        ).aggregate(s=Sum("current_balance"))["s"] or ZERO,
        "inventory_value": inv["estimated_fifo_value"],
        "inventory_kg": inv["total_kg"],
        "low_stock_count": inv["low_stock_count"],
        "overdue_customer_balance_count": Customer.objects.filter(
            company=company, current_balance__gt=0,
        ).count(),
        "overdue_supplier_payable_count": Supplier.objects.filter(
            company=company, current_balance__gt=0,
        ).count(),
        "sales_invoice_count": sales_qs.count(),
        "purchase_invoice_count": purchase_qs.count(),
        "quotations_open_count": Quotation.objects.filter(
            company=company,
            status__in=[QuotationStatus.DRAFT, QuotationStatus.SENT, QuotationStatus.ACCEPTED],
        ).count(),
        "pending_payments_count": PaymentMovement.objects.filter(
            company=company, status=PaymentMovementStatus.POSTED,
            movement_date__gte=date_from, movement_date__lte=date_to,
        ).count(),
        "tax_net_vat_estimate": tax_net,
        "sales_trend": _sales_trend(company, date_from, date_to),
    }


def get_sales_report(company, *, date_from, date_to, filters=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    qs = _sales_qs(
        company, date_from, date_to,
        include_draft=filters.get("include_drafts", False),
        include_cancelled=filters.get("include_cancelled", False),
    )
    if filters.get("customer"):
        qs = qs.filter(customer_id=filters["customer"])
    if filters.get("payment_status"):
        qs = qs.filter(payment_status=filters["payment_status"])
    if filters.get("status"):
        qs = qs.filter(status=filters["status"])

    records = list(qs.select_related("customer").order_by("invoice_date", "id").values(
        "id", "invoice_number", "invoice_date", "customer_id", "customer_name_snapshot",
        "subtotal", "discount_total", "vat_amount", "total_amount", "amount_paid",
        "balance_due", "fifo_cost_total", "gross_profit", "status", "payment_status",
    ))
    agg = qs.aggregate(
        subtotal=Sum("subtotal"), discount=Sum("discount_total"), vat=Sum("vat_amount"),
        total=Sum("total_amount"), paid=Sum("amount_paid"), due=Sum("balance_due"),
        fifo=Sum("fifo_cost_total"), gp=Sum("gross_profit"),
    )
    by_customer = list(
        qs.values("customer_id", "customer_name_snapshot")
        .annotate(total=Sum("total_amount"), count=Count("id"))
        .order_by("-total")[:50]
    )
    by_payment = list(qs.values("payment_status").annotate(total=Sum("total_amount"), count=Count("id")))
    by_date = list(qs.values("invoice_date").annotate(total=Sum("total_amount")).order_by("invoice_date"))

    by_product = []
    line_qs = SalesInvoiceLine.objects.filter(invoice__in=qs)
    by_product = list(
        line_qs.values("product_name_snapshot")
        .annotate(total=Sum("line_total"), qty_kg=Sum("quantity_kg"))
        .order_by("-total")[:50]
    )

    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "records": records,
        "totals": {
            "invoice_count": len(records),
            "subtotal": agg["subtotal"] or ZERO,
            "discount_total": agg["discount"] or ZERO,
            "vat_amount": agg["vat"] or ZERO,
            "total_amount": agg["total"] or ZERO,
            "amount_paid": agg["paid"] or ZERO,
            "balance_due": agg["due"] or ZERO,
            "fifo_cost_total": agg["fifo"] or ZERO,
            "gross_profit": agg["gp"] or ZERO,
        },
        "breakdowns": {
            "by_customer": by_customer,
            "by_product": by_product,
            "by_payment_status": by_payment,
            "by_date": [{"date": str(r["invoice_date"]), "total": r["total"]} for r in by_date],
        },
    }


def get_purchase_report(company, *, date_from, date_to, filters=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    qs = _purchase_qs(
        company, date_from, date_to,
        include_draft=filters.get("include_drafts", False),
        include_cancelled=filters.get("include_cancelled", False),
    )
    if filters.get("supplier"):
        qs = qs.filter(supplier_id=filters["supplier"])
    if filters.get("payment_status"):
        qs = qs.filter(payment_status=filters["payment_status"])

    records = list(qs.order_by("invoice_date", "id").values(
        "id", "invoice_number", "supplier_invoice_number", "invoice_date",
        "supplier_id", "supplier_name_snapshot", "subtotal", "adjustment_total",
        "vat_amount", "total_amount", "amount_paid", "balance_due", "status", "payment_status",
    ))
    agg = qs.aggregate(
        subtotal=Sum("subtotal"), adj=Sum("adjustment_total"), vat=Sum("vat_amount"),
        total=Sum("total_amount"), paid=Sum("amount_paid"), due=Sum("balance_due"),
    )
    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "records": records,
        "totals": {
            "invoice_count": len(records),
            "subtotal": agg["subtotal"] or ZERO,
            "adjustment_total": agg["adj"] or ZERO,
            "vat_amount": agg["vat"] or ZERO,
            "total_amount": agg["total"] or ZERO,
            "amount_paid": agg["paid"] or ZERO,
            "balance_due": agg["due"] or ZERO,
        },
        "breakdowns": {
            "by_supplier": list(
                qs.values("supplier_id", "supplier_name_snapshot")
                .annotate(total=Sum("total_amount"), count=Count("id")).order_by("-total")[:50]
            ),
            "by_payment_status": list(qs.values("payment_status").annotate(total=Sum("total_amount"))),
            "by_date": list(qs.values("invoice_date").annotate(total=Sum("total_amount")).order_by("invoice_date")),
        },
    }


def get_inventory_report(company, *, filters=None) -> dict:
    filters = filters or {}
    summary = get_inventory_summary(company)
    balances = InventoryBalance.objects.filter(company=company).select_related("product")
    if filters.get("product"):
        balances = balances.filter(product_id=filters["product"])

    stock_records = [
        {
            "product_id": b.product_id,
            "product_name": b.product.name_ar,
            "sku": b.product.sku,
            "available_cartons": b.available_cartons,
            "available_pieces": b.available_pieces,
            "available_kg": b.available_kg,
            "stock_status": b.stock_status,
            "fifo_value": estimate_fifo_value(company, b.product),
        }
        for b in balances
    ]
    low_stock = [r for r in stock_records if r["stock_status"] == "low"]
    out_stock = [r for r in stock_records if r["stock_status"] == "out_of_stock"]
    top_value = sorted(stock_records, key=lambda x: x["fifo_value"], reverse=True)[:10]

    chart_status = [
        {"status": "available", "count": summary["active_products_count"] - summary["low_stock_count"] - summary["out_of_stock_count"]},
        {"status": "low", "count": summary["low_stock_count"]},
        {"status": "out_of_stock", "count": summary["out_of_stock_count"]},
    ]

    return {
        "balances": stock_records,
        "totals": {
            "total_cartons": summary["total_cartons"],
            "total_pieces": summary["total_pieces"],
            "total_kg": summary["total_kg"],
            "total_fifo_value": summary["estimated_fifo_value"],
            "low_stock_count": summary["low_stock_count"],
            "out_of_stock_count": summary["out_of_stock_count"],
        },
        "low_stock_products": low_stock,
        "out_of_stock_products": out_stock,
        "top_stock_value_products": top_value,
        "chart_status": chart_status,
    }


def get_inventory_movement_report(company, *, date_from, date_to, filters=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    qs = StockMovement.objects.filter(
        company=company, created_at__date__gte=date_from, created_at__date__lte=date_to,
    ).select_related("product")
    if filters.get("product"):
        qs = qs.filter(product_id=filters["product"])
    if filters.get("movement_type"):
        qs = qs.filter(movement_type=filters["movement_type"])

    inbound = qs.filter(direction=MovementDirection.IN).aggregate(
        cartons=Sum("cartons_delta"), pieces=Sum("pieces_delta"),
        kg=Sum("kg_delta"), cost=Sum("fifo_cost_consumed"),
    )
    outbound = qs.filter(direction=MovementDirection.OUT).aggregate(
        cartons=Sum("cartons_delta"), pieces=Sum("pieces_delta"),
        kg=Sum("kg_delta"), cost=Sum("fifo_cost_consumed"),
    )
    by_type = list(qs.values("movement_type").annotate(count=Count("id"), kg=Sum("kg_delta")))
    by_product = list(
        qs.values("product_id", "product__name_ar")
        .annotate(kg=Sum("kg_delta"), count=Count("id")).order_by("-kg")[:30]
    )
    records = list(qs.order_by("-created_at")[:200].values(
        "id", "movement_type", "direction", "product_id", "cartons_delta",
        "pieces_delta", "kg_delta", "fifo_cost_consumed", "reference_number", "created_at",
    ))

    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "records": records,
        "totals": {
            "inbound_cartons": inbound["cartons"] or ZERO,
            "inbound_pieces": inbound["pieces"] or ZERO,
            "inbound_kg": inbound["kg"] or ZERO,
            "outbound_cartons": abs(outbound["cartons"] or ZERO),
            "outbound_pieces": abs(outbound["pieces"] or ZERO),
            "outbound_kg": abs(outbound["kg"] or ZERO),
            "fifo_cost_consumed": outbound["cost"] or ZERO,
        },
        "breakdowns": {"by_movement_type": by_type, "by_product": by_product},
    }


def get_customer_statement(company, customer, *, date_from=None, date_to=None) -> dict:
    if customer.company_id != company.id:
        raise ValidationError({"customer": "Customer must belong to your company."})
    today = timezone.now().date()
    date_from, date_to = _parse_dates(date_from or today.replace(day=1), date_to or today)

    entries_before = customer.ledger_entries.filter(entry_date__lt=date_from)
    ob_agg = entries_before.aggregate(d=Sum("debit"), c=Sum("credit"))
    opening = (ob_agg["d"] or ZERO) - (ob_agg["c"] or ZERO)

    period_entries = list(
        customer.ledger_entries.filter(entry_date__gte=date_from, entry_date__lte=date_to)
        .order_by("entry_date", "id").values(
            "id", "entry_type", "debit", "credit", "balance_after",
            "description", "entry_date", "reference_number",
        )
    )
    period_agg = customer.ledger_entries.filter(
        entry_date__gte=date_from, entry_date__lte=date_to,
    ).aggregate(d=Sum("debit"), c=Sum("credit"))

    open_invoices = list(
        SalesInvoice.objects.filter(
            company=company, customer=customer, balance_due__gt=0,
        ).exclude(status=SalesStatus.CANCELLED).values(
            "id", "invoice_number", "invoice_date", "due_date", "total_amount",
            "amount_paid", "balance_due", "status",
        )
    )
    aging = _aging_buckets(
        SalesInvoice.objects.filter(company=company, customer=customer, balance_due__gt=0)
        .exclude(status=SalesStatus.CANCELLED),
        today=today, date_field="due_date",
    )

    return {
        "customer_id": customer.id,
        "customer_name": customer.name_ar,
        "date_from": str(date_from),
        "date_to": str(date_to),
        "opening_balance": opening,
        "debit_total": period_agg["d"] or ZERO,
        "credit_total": period_agg["c"] or ZERO,
        "closing_balance": get_customer_balance(customer),
        "ledger_entries": period_entries,
        "open_sales_invoices": open_invoices,
        "aging_buckets": aging,
    }


def get_supplier_statement(company, supplier, *, date_from=None, date_to=None) -> dict:
    if supplier.company_id != company.id:
        raise ValidationError({"supplier": "Supplier must belong to your company."})
    today = timezone.now().date()
    date_from, date_to = _parse_dates(date_from or today.replace(day=1), date_to or today)

    entries_before = supplier.ledger_entries.filter(entry_date__lt=date_from)
    ob_agg = entries_before.aggregate(d=Sum("debit"), c=Sum("credit"))
    opening = (ob_agg["c"] or ZERO) - (ob_agg["d"] or ZERO)

    period_entries = list(
        supplier.ledger_entries.filter(entry_date__gte=date_from, entry_date__lte=date_to)
        .order_by("entry_date", "id").values(
            "id", "entry_type", "debit", "credit", "balance_after",
            "description", "entry_date", "reference_number",
        )
    )
    period_agg = supplier.ledger_entries.filter(
        entry_date__gte=date_from, entry_date__lte=date_to,
    ).aggregate(d=Sum("debit"), c=Sum("credit"))

    open_invoices = list(
        PurchaseInvoice.objects.filter(
            company=company, supplier=supplier, balance_due__gt=0,
        ).exclude(status=PurchaseStatus.CANCELLED).values(
            "id", "invoice_number", "invoice_date", "due_date", "total_amount",
            "amount_paid", "balance_due", "status",
        )
    )
    aging = _aging_buckets(
        PurchaseInvoice.objects.filter(company=company, supplier=supplier, balance_due__gt=0)
        .exclude(status=PurchaseStatus.CANCELLED),
        today=today, date_field="due_date",
    )

    return {
        "supplier_id": supplier.id,
        "supplier_name": supplier.name_ar,
        "date_from": str(date_from),
        "date_to": str(date_to),
        "opening_balance": opening,
        "debit_total": period_agg["d"] or ZERO,
        "credit_total": period_agg["c"] or ZERO,
        "closing_balance": get_supplier_balance(supplier),
        "ledger_entries": period_entries,
        "open_purchase_invoices": open_invoices,
        "aging_buckets": aging,
    }


def get_customers_aging_report(company) -> dict:
    today = timezone.now().date()
    customers = []
    for c in Customer.objects.filter(company=company, current_balance__gt=0):
        open_inv = SalesInvoice.objects.filter(
            company=company, customer=c, balance_due__gt=0,
        ).exclude(status=SalesStatus.CANCELLED)
        customers.append({
            "customer_id": c.id,
            "customer_name": c.name_ar,
            "current_balance": c.current_balance,
            "aging_buckets": _aging_buckets(open_inv, today=today, date_field="due_date"),
        })
    return {"as_of": str(today), "customers": customers}


def get_suppliers_aging_report(company) -> dict:
    today = timezone.now().date()
    suppliers = []
    for s in Supplier.objects.filter(company=company, current_balance__gt=0):
        open_inv = PurchaseInvoice.objects.filter(
            company=company, supplier=s, balance_due__gt=0,
        ).exclude(status=PurchaseStatus.CANCELLED)
        suppliers.append({
            "supplier_id": s.id,
            "supplier_name": s.name_ar,
            "current_balance": s.current_balance,
            "aging_buckets": _aging_buckets(open_inv, today=today, date_field="due_date"),
        })
    return {"as_of": str(today), "suppliers": suppliers}


def get_payments_report(company, *, date_from, date_to, filters=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    qs = _payments_qs(
        company, date_from, date_to,
        include_cancelled=filters.get("include_cancelled", False),
    )
    if filters.get("payment_method"):
        qs = qs.filter(payment_method=filters["payment_method"])

    def _sum_type(mtype):
        return qs.filter(movement_type=mtype).aggregate(s=Sum("amount"))["s"] or ZERO

    cancelled = PaymentMovement.objects.filter(
        company=company, status=PaymentMovementStatus.CANCELLED,
        movement_date__gte=date_from, movement_date__lte=date_to,
    ).aggregate(s=Sum("amount"))["s"] or ZERO

    collections = _sum_type(PaymentMovementType.CUSTOMER_COLLECTION)
    supplier_pays = _sum_type(PaymentMovementType.SUPPLIER_PAYMENT)
    cust_refunds = _sum_type(PaymentMovementType.CUSTOMER_REFUND)
    sup_refunds = _sum_type(PaymentMovementType.SUPPLIER_REFUND)
    net = (collections + sup_refunds) - (supplier_pays + cust_refunds)

    records = list(qs.order_by("-movement_date", "-id")[:500].values(
        "id", "movement_number", "movement_type", "movement_date", "amount",
        "payment_method", "status", "party_type", "customer_id", "supplier_id",
    ))

    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "records": records,
        "totals": {
            "customer_collections": collections,
            "supplier_payments": supplier_pays,
            "customer_refunds": cust_refunds,
            "supplier_refunds": sup_refunds,
            "cancelled_total": cancelled,
            "net_cash_movement": net,
        },
        "breakdowns": {
            "by_payment_method": list(qs.values("payment_method").annotate(total=Sum("amount"))),
            "by_movement_type": list(qs.values("movement_type").annotate(total=Sum("amount"))),
            "by_date": list(qs.values("movement_date").annotate(total=Sum("amount")).order_by("movement_date")),
        },
    }


def get_expenses_report(company, *, date_from, date_to, filters=None) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    summary = get_expense_summary(company, date_from=date_from, date_to=date_to)
    qs = _expense_qs(company, date_from, date_to)
    if filters.get("category"):
        qs = qs.filter(category_id=filters["category"])
    if filters.get("expense_scope"):
        qs = qs.filter(expense_scope=filters["expense_scope"])

    records = list(qs.select_related("category").order_by("expense_date", "id").values(
        "id", "expense_number", "expense_date", "title", "amount", "vat_amount",
        "total_amount", "payment_method", "expense_scope", "category__name_ar",
    ))
    by_scope = list(qs.values("expense_scope").annotate(total=Sum("total_amount")))
    by_date = list(qs.values("expense_date").annotate(total=Sum("total_amount")).order_by("expense_date"))

    chart_categories = [
        {"label": row["category__name_ar"], "value": str(row["total"])}
        for row in summary.get("category_breakdown", [])
    ]

    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "records": records,
        "totals": {
            "expense_count": len(records),
            "amount_total": summary["total_expenses"],
            "vat_total": qs.aggregate(s=Sum("vat_amount"))["s"] or ZERO,
            "total_amount": summary["total_expenses"],
            "recurring_due_count": summary["recurring_due_count"],
        },
        "breakdowns": {
            "by_category": summary.get("category_breakdown", []),
            "by_payment_method": summary.get("payment_method_breakdown", []),
            "by_scope": by_scope,
            "by_date": [{"date": str(r["expense_date"]), "total": r["total"]} for r in by_date],
        },
        "chart_categories": chart_categories,
    }


def get_profit_report(company, *, date_from, date_to) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    sales_qs = _sales_qs(company, date_from, date_to)
    expense_qs = _expense_qs(company, date_from, date_to)

    sales_total = sales_qs.aggregate(s=Sum("total_amount"))["s"] or ZERO
    fifo_cost = sales_qs.aggregate(s=Sum("fifo_cost_total"))["s"] or ZERO
    gross_profit = sales_qs.aggregate(s=Sum("gross_profit"))["s"] or ZERO
    expenses_total = expense_qs.aggregate(s=Sum("total_amount"))["s"] or ZERO
    net_profit = gross_profit - expenses_total

    gross_margin = (gross_profit / sales_total * 100) if sales_total > 0 else ZERO
    net_margin = (net_profit / sales_total * 100) if sales_total > 0 else ZERO

    profit_by_day = list(
        sales_qs.values("invoice_date")
        .annotate(sales=Sum("total_amount"), gross_profit=Sum("gross_profit"))
        .order_by("invoice_date")
    )
    by_customer = list(
        sales_qs.values("customer_id", "customer_name_snapshot")
        .annotate(sales=Sum("total_amount"), gross_profit=Sum("gross_profit"))
        .order_by("-gross_profit")[:30]
    )
    by_product = list(
        SalesInvoiceLine.objects.filter(invoice__in=sales_qs)
        .values("product_name_snapshot")
        .annotate(revenue=Sum("line_total"), profit=Sum("gross_profit"))
        .order_by("-profit")[:30]
    )

    return {
        "date_from": str(date_from), "date_to": str(date_to),
        "sales_total": sales_total,
        "fifo_cost_total": fifo_cost,
        "gross_profit": gross_profit,
        "expenses_total": expenses_total,
        "net_profit_foundation": net_profit,
        "gross_margin_percentage": gross_margin.quantize(Decimal("0.01")),
        "net_margin_percentage": net_margin.quantize(Decimal("0.01")),
        "profit_by_day": [
            {"date": str(r["invoice_date"]), "sales": r["sales"], "gross_profit": r["gross_profit"]}
            for r in profit_by_day
        ],
        "profit_by_customer": by_customer,
        "profit_by_product": by_product,
        "note": "Foundation estimate — not final accounting.",
    }


def get_tax_summary_bridge(company, *, date_from, date_to) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    try:
        from apps.tax.models import TaxWarning, TaxWarningStatus
        from apps.tax.services import get_disabled_vat_documents, get_net_vat_estimate

        net = get_net_vat_estimate(company, date_from=date_from, date_to=date_to)
        warning_count = TaxWarning.objects.filter(
            company=company, status=TaxWarningStatus.OPEN,
        ).count()
        disabled = get_disabled_vat_documents(
            company, date_from=date_from, date_to=date_to,
        )
        disabled_count = len(disabled.get("records", []))

        return {
            "available": True,
            "output_vat": net["output_vat"],
            "input_vat": net["total_input_vat"],
            "net_vat": net["net_vat"],
            "payable_or_recoverable": net["status"],
            "warning_count": warning_count,
            "disabled_vat_count": disabled_count,
            "note": net.get("note", ""),
        }
    except ImportError:
        return {
            "available": False,
            "message": "Tax app not available.",
        }


REPORT_BUILDERS = {
    "dashboard": lambda c, df, dt, f: get_dashboard_summary(c, date_from=df, date_to=dt),
    "sales": get_sales_report,
    "purchases": get_purchase_report,
    "inventory": lambda c, df, dt, f: get_inventory_report(c, filters=f),
    "inventory_movements": get_inventory_movement_report,
    "payments": get_payments_report,
    "expenses": get_expenses_report,
    "profit": get_profit_report,
    "tax_summary": get_tax_summary_bridge,
}


def build_export_payload(
    company, *, report_type, date_from, date_to, filters=None, user=None,
) -> dict:
    date_from, date_to = _parse_dates(date_from, date_to)
    filters = filters or {}
    builder = REPORT_BUILDERS.get(report_type)
    if not builder:
        raise ValidationError({"report_type": f"Unknown report type: {report_type}"})

    if report_type in ("inventory",):
        report_data = builder(company, date_from, date_to, filters)
    elif report_type == "dashboard":
        report_data = builder(company, date_from, date_to, filters)
    elif report_type == "tax_summary":
        report_data = builder(company, date_from=date_from, date_to=date_to)
    else:
        report_data = builder(company, date_from=date_from, date_to=date_to, filters=filters)

    if user:
        create_audit_log(
            action="report_export", user=user, company=company,
            module="reports", reference_type="report", reference_id=report_type,
            reason="", new_value={"report_type": report_type, "date_from": str(date_from)},
            risk_level=risk_for_action("report_export"),
        )

    return {
        "metadata": {
            "report_type": report_type,
            "generated_at": timezone.now().isoformat(),
            "generated_by": user.full_name if user else "",
            "disclaimer": "Computed from tenant transaction data only.",
        },
        "company": {"name_ar": company.name_ar, "name_en": company.name_en, "trn": company.trn},
        "date_from": str(date_from),
        "date_to": str(date_to),
        "filters": filters,
        "report": report_data,
    }
