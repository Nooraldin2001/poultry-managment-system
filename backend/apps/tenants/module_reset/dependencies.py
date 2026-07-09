"""Module reset dependency checks and required reset order (no force reset)."""

from __future__ import annotations

from apps.customers.models import CustomerLedgerEntry
from apps.inventory.models import FIFOStockLayer, InventoryBalance, StockMovement
from apps.payments.models import PaymentAllocation, PaymentMovement
from apps.products.models import Product
from apps.purchases.models import PurchaseInvoice, PurchaseInvoiceLine, PurchaseStatus
from apps.quotations.models import Quotation, QuotationLine
from apps.sales.models import (
    SalesInventoryAllocation,
    SalesInvoice,
    SalesInvoiceLine,
    SalesStatus,
)
from apps.suppliers.models import SupplierLedgerEntry
from apps.expenses.models import Expense

from .plan import ResetPlan

_POSTED_SALES = [
    SalesStatus.APPROVED,
    SalesStatus.PARTIALLY_PAID,
    SalesStatus.PAID,
]
_POSTED_PURCHASES = [
    PurchaseStatus.APPROVED,
    PurchaseStatus.PARTIALLY_PAID,
    PurchaseStatus.PAID,
]

FORCE_RESET_KEYS = frozenset({
    "force",
    "force_reset",
    "force_rebuild",
    "delete_anyway",
    "ignore_dependencies",
    "override_dependencies",
})

FORCE_RESET_MESSAGE = "Force reset is not allowed. Resolve dependencies first."


def has_posted_sales(company) -> bool:
    return SalesInvoice.objects.filter(company=company, status__in=_POSTED_SALES).exists()


def has_posted_purchases(company) -> bool:
    return PurchaseInvoice.objects.filter(company=company, status__in=_POSTED_PURCHASES).exists()


def has_sales_payment_allocations(company) -> bool:
    return PaymentAllocation.objects.filter(
        company=company, sales_invoice_id__isnull=False
    ).exists()


def has_sales_inventory_allocations(company) -> bool:
    return SalesInventoryAllocation.objects.filter(company=company).exists()


def has_sales_stock_movements(company) -> bool:
    return StockMovement.objects.filter(
        company=company, reference_type="sales_invoice"
    ).exists()


def purchases_blocked_by_sales(company) -> bool:
    return (
        has_posted_sales(company)
        or has_sales_inventory_allocations(company)
        or has_sales_stock_movements(company)
        or has_sales_payment_allocations(company)
    )


def has_customer_sales(company) -> bool:
    return SalesInvoice.objects.filter(company=company).exclude(
        status=SalesStatus.DRAFT
    ).exists()


def has_customer_payments(company) -> bool:
    return PaymentMovement.objects.filter(company=company).exists()


def has_customer_ledger(company) -> bool:
    return CustomerLedgerEntry.objects.filter(company=company).exclude(
        entry_type=CustomerLedgerEntry.EntryType.OPENING_BALANCE
    ).exists()


def has_customer_quotations(company) -> bool:
    return Quotation.objects.filter(company=company).exists()


def has_supplier_purchases(company) -> bool:
    return PurchaseInvoice.objects.filter(company=company).exclude(
        status=PurchaseStatus.DRAFT
    ).exists()


def has_supplier_ledger(company) -> bool:
    return SupplierLedgerEntry.objects.filter(company=company).exclude(
        entry_type=SupplierLedgerEntry.EntryType.OPENING_BALANCE
    ).exists()


def has_product_references(company) -> bool:
    if SalesInvoiceLine.objects.filter(company=company).exists():
        return True
    if PurchaseInvoiceLine.objects.filter(company=company).exists():
        return True
    if QuotationLine.objects.filter(company=company).exists():
        return True
    if InventoryBalance.objects.filter(company=company).exists():
        return True
    if StockMovement.objects.filter(company=company).exists():
        return True
    if FIFOStockLayer.objects.filter(company=company).exists():
        return True
    return False


def block_plan(
    plan: ResetPlan,
    *,
    en: list[str],
    ar: list[str],
    order: list[str],
) -> ResetPlan:
    plan.can_reset = False
    plan.blocking_dependencies.extend(en)
    plan.blocking_dependencies_ar.extend(ar)
    plan.required_reset_order = order
    return plan


def block_sales(plan: ResetPlan) -> ResetPlan:
    return block_plan(
        plan,
        en=[
            "Cannot reset sales while payment allocations exist. Reset payments first.",
        ],
        ar=[
            "لا يمكن تصفير المبيعات قبل تصفير المدفوعات والتحصيلات المرتبطة بها.",
        ],
        order=["payments", "sales"],
    )


def block_purchases(plan: ResetPlan) -> ResetPlan:
    return block_plan(
        plan,
        en=[
            (
                "Cannot reset purchases while sales exist. Reset sales first."
            ),
            (
                "Purchases cannot be reset while approved sales exist because sales "
                "may have consumed purchased FIFO stock."
            ),
            "Reset Sales first, then Payments if needed, then retry Purchases.",
        ],
        ar=[
            "لا يمكن تصفير المشتريات قبل تصفير المبيعات المرتبطة بها. قم بتصفير المبيعات أولاً.",
            (
                "لا يمكن تصفير المشتريات مع وجود مبيعات معتمدة قد تكون استهلكت مخزون الشراء."
            ),
            "قم بتصفير المبيعات أولاً، ثم المدفوعات إن لزم، ثم أعد محاولة تصفير المشتريات.",
        ],
        order=["payments", "sales", "inventory", "purchases"],
    )


def block_inventory(plan: ResetPlan) -> ResetPlan:
    return block_plan(
        plan,
        en=[
            (
                "Cannot reset inventory while approved purchases or sales exist. "
                "Reset sales and purchases first."
            ),
        ],
        ar=[
            "لا يمكن تصفير المخزون مع وجود فواتير بيع أو شراء معتمدة. قم بتصفير المبيعات والمشتريات أولاً.",
        ],
        order=["payments", "sales", "purchases", "inventory"],
    )


def block_customers(plan: ResetPlan) -> ResetPlan:
    return block_plan(
        plan,
        en=[
            (
                "Customers cannot be reset while sales, payments, quotations, "
                "or customer ledger entries exist. Reset dependent modules first."
            ),
        ],
        ar=[
            "لا يمكن تصفير العملاء مع وجود مبيعات أو مدفوعات أو عروض أسعار أو قيود محاسبية.",
        ],
        order=["payments", "sales", "quotations", "customers"],
    )


def block_suppliers(plan: ResetPlan) -> ResetPlan:
    return block_plan(
        plan,
        en=[
            (
                "Suppliers cannot be reset while purchases, payments, "
                "or supplier ledger entries exist. Reset dependent modules first."
            ),
        ],
        ar=[
            "لا يمكن تصفير الموردين مع وجود مشتريات أو مدفوعات أو قيود محاسبية.",
        ],
        order=["payments", "purchases", "suppliers"],
    )


def block_products(plan: ResetPlan) -> ResetPlan:
    return block_plan(
        plan,
        en=[
            (
                "Products cannot be reset while referenced by sales, purchases, "
                "quotations, inventory balances, stock movements, or FIFO layers."
            ),
        ],
        ar=[
            "لا يمكن تصفير المنتجات مع وجود مراجع في المبيعات أو المشتريات أو المخزون.",
        ],
        order=["payments", "sales", "purchases", "quotations", "inventory", "products"],
    )


def block_treasury(plan: ResetPlan) -> ResetPlan:
    return block_plan(
        plan,
        en=[
            (
                "Treasury cannot be reset while payments, expenses, or paid purchases exist. "
                "Reset dependent modules first."
            ),
        ],
        ar=[
            "لا يمكن تصفير الخزينة مع وجود مدفوعات أو مصروفات أو مشتريات مدفوعة.",
        ],
        order=["payments", "expenses", "purchases", "treasury"],
    )


def customers_blocked(company) -> bool:
    return (
        has_customer_sales(company)
        or has_customer_payments(company)
        or has_customer_ledger(company)
        or has_customer_quotations(company)
    )


def suppliers_blocked(company) -> bool:
    return (
        has_supplier_purchases(company)
        or has_supplier_ledger(company)
        or PaymentMovement.objects.filter(company=company).exists()
    )


def treasury_blocked(company) -> bool:
    if PaymentMovement.objects.filter(company=company).exists():
        return True
    if Expense.objects.filter(company=company).exists():
        return True
    if PurchaseInvoice.objects.filter(company=company, amount_paid__gt=0).exists():
        return True
    return False
