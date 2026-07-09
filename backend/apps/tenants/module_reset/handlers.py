from __future__ import annotations

from typing import Callable

from django.db import transaction
from django.db.models import F

from apps.customers.models import (
    Customer,
    CustomerCategory,
    CustomerCreditLimitChange,
    CustomerFreeProductAgreement,
    CustomerLedgerEntry,
    CustomerSpecialPrice,
)
from apps.expenses.models import (
    Expense,
    ExpenseAttachment,
    ExpenseCategory,
    ExpenseStatusHistory,
    RecurringExpense,
)
from apps.inventory.models import (
    FIFOStockLayer,
    InventoryBalance,
    InventoryValuationSnapshot,
    StockAdjustment,
    StockMovement,
    StockSourceType,
    StocktakingLine,
    StocktakingSession,
)
from apps.payments.models import (
    MoneyAccount,
    MoneyMovement,
    PaymentAllocation,
    PaymentMovement,
    PaymentStatusHistory,
)
from apps.products.models import Product, ProductCategory
from apps.purchases.models import (
    PurchaseAdjustment,
    PurchaseAttachment,
    PurchaseInvoice,
    PurchaseInvoiceLine,
    PurchaseStatus,
    PurchaseStatusHistory,
)
from apps.quotations.models import Quotation, QuotationLine, QuotationStatusHistory
from apps.sales.models import (
    SalesInventoryAllocation,
    SalesInvoice,
    SalesInvoiceAdjustment,
    SalesInvoiceLine,
    SalesStatus,
    SalesStatusHistory,
)
from apps.suppliers.models import (
    Supplier,
    SupplierAgreement,
    SupplierCategory,
    SupplierLedgerEntry,
    SupplierSpecialPrice,
)
from apps.tax.models import TaxAdjustment, TaxPeriod, TaxPeriodStatus, TaxWarning

from .dependencies import (
    block_customers,
    block_inventory,
    block_products,
    block_purchases,
    block_sales,
    block_suppliers,
    block_treasury,
    customers_blocked,
    has_posted_purchases,
    has_posted_sales,
    has_product_references,
    has_sales_payment_allocations,
    purchases_blocked_by_sales,
    suppliers_blocked,
    treasury_blocked,
)
from .plan import ResetPlan
from .recalc import (
    rebuild_customer_balances,
    rebuild_inventory_balances_from_layers,
    rebuild_money_account_balances,
    rebuild_supplier_balances,
)

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


def _count(qs) -> int:
    return qs.count()


def _sales_invoice_ids(company):
    return SalesInvoice.objects.filter(company=company).values_list("id", flat=True)


def _purchase_invoice_ids(company):
    return PurchaseInvoice.objects.filter(company=company).values_list("id", flat=True)


def dry_run_sales(company) -> ResetPlan:
    plan = ResetPlan(danger_level="high")
    if has_sales_payment_allocations(company):
        return block_sales(plan)
    inv_ids = list(_sales_invoice_ids(company))
    plan.affected_counts = {
        "sales_invoices": len(inv_ids),
        "sales_lines": _count(SalesInvoiceLine.objects.filter(company=company)),
        "sales_adjustments": _count(SalesInvoiceAdjustment.objects.filter(company=company)),
        "sales_allocations": _count(SalesInventoryAllocation.objects.filter(company=company)),
        "sales_status_history": _count(SalesStatusHistory.objects.filter(company=company)),
        "payment_allocations": _count(
            PaymentAllocation.objects.filter(company=company, sales_invoice_id__in=inv_ids)
        ),
        "customer_ledger_entries": _count(
            CustomerLedgerEntry.objects.filter(company=company, reference_type="sales_invoice")
        ),
        "stock_movements": _count(
            StockMovement.objects.filter(company=company, reference_type="sales_invoice")
        ),
    }
    plan.side_effects = [
        "Customer balances will be recalculated from remaining ledger entries",
        "Inventory balances will be synced from remaining FIFO layers (consumed stock is not restored)",
        "Sales reports will become zero for deleted invoices",
    ]
    return plan


def _delete_sales(company) -> dict:
    inv_ids = list(_sales_invoice_ids(company))
    deleted = {}
    deleted["payment_allocations"] = PaymentAllocation.objects.filter(
        company=company, sales_invoice_id__in=inv_ids
    ).delete()[0]
    deleted["sales_inventory_allocations"] = SalesInventoryAllocation.objects.filter(
        company=company
    ).delete()[0]
    deleted["sales_status_history"] = SalesStatusHistory.objects.filter(
        company=company
    ).delete()[0]
    deleted["sales_adjustments"] = SalesInvoiceAdjustment.objects.filter(
        company=company
    ).delete()[0]
    deleted["sales_lines"] = SalesInvoiceLine.objects.filter(company=company).delete()[0]
    deleted["sales_invoices"] = SalesInvoice.objects.filter(company=company).delete()[0]
    deleted["customer_ledger_entries"] = CustomerLedgerEntry.objects.filter(
        company=company, reference_type="sales_invoice"
    ).delete()[0]
    deleted["stock_movements"] = StockMovement.objects.filter(
        company=company, reference_type="sales_invoice"
    ).delete()[0]
    return deleted


def confirm_sales(company) -> ResetPlan:
    plan = dry_run_sales(company)
    if not plan.can_reset:
        return plan
    with transaction.atomic():
        plan.deleted_counts = _delete_sales(company)
        plan.recalculation = {
            "customers_updated": rebuild_customer_balances(company),
            "inventory_balances_updated": rebuild_inventory_balances_from_layers(company),
        }
    return plan


def dry_run_purchases(company) -> ResetPlan:
    plan = ResetPlan(danger_level="high")
    if purchases_blocked_by_sales(company):
        return block_purchases(plan)
    pur_ids = list(_purchase_invoice_ids(company))
    plan.affected_counts = {
        "purchase_invoices": len(pur_ids),
        "purchase_lines": _count(PurchaseInvoiceLine.objects.filter(company=company)),
        "purchase_adjustments": _count(PurchaseAdjustment.objects.filter(company=company)),
        "purchase_attachments": _count(PurchaseAttachment.objects.filter(company=company)),
        "purchase_status_history": _count(PurchaseStatusHistory.objects.filter(company=company)),
        "payment_allocations": _count(
            PaymentAllocation.objects.filter(company=company, purchase_invoice_id__in=pur_ids)
        ),
        "supplier_ledger_entries": _count(
            SupplierLedgerEntry.objects.filter(company=company, reference_type="purchase_invoice")
        ),
        "stock_movements": _count(
            StockMovement.objects.filter(company=company, reference_type="purchase_invoice")
        ),
        "fifo_layers": _count(
            FIFOStockLayer.objects.filter(
                company=company, source_type=StockSourceType.PURCHASE_INVOICE
            )
        ),
        "money_movements": _count(
            MoneyMovement.objects.filter(company=company, reference_type="purchase_invoice")
        ),
    }
    plan.side_effects = [
        "Supplier balances will be recalculated",
        "Inventory balances will be synced from remaining FIFO layers",
        "Purchase reports and input VAT will become zero",
    ]
    return plan


def _delete_purchases(company) -> dict:
    pur_ids = list(_purchase_invoice_ids(company))
    deleted = {}
    deleted["payment_allocations"] = PaymentAllocation.objects.filter(
        company=company, purchase_invoice_id__in=pur_ids
    ).delete()[0]
    deleted["money_movements"] = MoneyMovement.objects.filter(
        company=company, reference_type="purchase_invoice"
    ).delete()[0]
    deleted["purchase_status_history"] = PurchaseStatusHistory.objects.filter(
        company=company
    ).delete()[0]
    deleted["purchase_attachments"] = PurchaseAttachment.objects.filter(
        company=company
    ).delete()[0]
    deleted["purchase_adjustments"] = PurchaseAdjustment.objects.filter(
        company=company
    ).delete()[0]
    deleted["purchase_lines"] = PurchaseInvoiceLine.objects.filter(
        company=company
    ).delete()[0]
    deleted["purchase_invoices"] = PurchaseInvoice.objects.filter(
        company=company
    ).delete()[0]
    deleted["supplier_ledger_entries"] = SupplierLedgerEntry.objects.filter(
        company=company, reference_type="purchase_invoice"
    ).delete()[0]
    deleted["stock_movements"] = StockMovement.objects.filter(
        company=company, reference_type="purchase_invoice"
    ).delete()[0]
    deleted["fifo_layers"] = FIFOStockLayer.objects.filter(
        company=company, source_type=StockSourceType.PURCHASE_INVOICE
    ).delete()[0]
    return deleted


def confirm_purchases(company) -> ResetPlan:
    plan = dry_run_purchases(company)
    if not plan.can_reset:
        return plan
    with transaction.atomic():
        plan.deleted_counts = _delete_purchases(company)
        plan.recalculation = {
            "suppliers_updated": rebuild_supplier_balances(company),
            "inventory_balances_updated": rebuild_inventory_balances_from_layers(company),
            "money_accounts_updated": rebuild_money_account_balances(company),
        }
    return plan


def dry_run_payments(company) -> ResetPlan:
    plan = ResetPlan(danger_level="high")
    plan.affected_counts = {
        "payment_movements": _count(PaymentMovement.objects.filter(company=company)),
        "payment_allocations": _count(PaymentAllocation.objects.filter(company=company)),
        "payment_status_history": _count(
            PaymentStatusHistory.objects.filter(company=company)
        ),
    }
    plan.side_effects = [
        "Approved sales/purchase invoices will have payment fields reset to unpaid",
        "Customer and supplier balances will be recalculated",
        "Treasury balances are not changed by payments-only reset (use treasury reset)",
    ]
    return plan


def _delete_payments(company) -> dict:
    deleted = {}
    movement_ids = list(
        PaymentMovement.objects.filter(company=company).values_list("id", flat=True)
    )
    deleted["payment_status_history"] = PaymentStatusHistory.objects.filter(
        company=company, movement_id__in=movement_ids
    ).delete()[0]
    deleted["payment_allocations"] = PaymentAllocation.objects.filter(
        company=company
    ).delete()[0]
    deleted["payment_movements"] = PaymentMovement.objects.filter(
        company=company
    ).delete()[0]
    return deleted


def confirm_payments(company) -> ResetPlan:
    plan = dry_run_payments(company)
    if not plan.can_reset:
        return plan
    with transaction.atomic():
        plan.deleted_counts = _delete_payments(company)
        plan.deleted_counts["sales_payment_reset"] = SalesInvoice.objects.filter(
            company=company, status__in=_POSTED_SALES
        ).update(payment_status="unpaid", amount_paid=0, balance_due=F("total_amount"))
        plan.deleted_counts["purchase_payment_reset"] = PurchaseInvoice.objects.filter(
            company=company, status__in=_POSTED_PURCHASES
        ).update(payment_status="unpaid", amount_paid=0, balance_due=F("total_amount"))
        plan.recalculation = {
            "customers_updated": rebuild_customer_balances(company),
            "suppliers_updated": rebuild_supplier_balances(company),
        }
    return plan


def dry_run_expenses(company) -> ResetPlan:
    plan = ResetPlan(danger_level="medium")
    plan.affected_counts = {
        "expenses": _count(Expense.objects.filter(company=company)),
        "expense_attachments": _count(ExpenseAttachment.objects.filter(company=company)),
        "expense_status_history": _count(ExpenseStatusHistory.objects.filter(company=company)),
        "recurring_expenses": _count(RecurringExpense.objects.filter(company=company)),
        "expense_categories": _count(ExpenseCategory.objects.filter(company=company)),
        "money_movements": _count(
            MoneyMovement.objects.filter(company=company, reference_type="expense")
        ),
    }
    plan.side_effects = [
        "Expense-related treasury movements will be deleted",
        "Profit and tax reports will recalculate from remaining data",
    ]
    return plan


def _delete_expenses(company) -> dict:
    deleted = {}
    deleted["money_movements"] = MoneyMovement.objects.filter(
        company=company, reference_type="expense"
    ).delete()[0]
    deleted["expense_status_history"] = ExpenseStatusHistory.objects.filter(
        company=company
    ).delete()[0]
    deleted["expense_attachments"] = ExpenseAttachment.objects.filter(
        company=company
    ).delete()[0]
    deleted["expenses"] = Expense.objects.filter(company=company).delete()[0]
    deleted["recurring_expenses"] = RecurringExpense.objects.filter(
        company=company
    ).delete()[0]
    deleted["expense_categories"] = ExpenseCategory.objects.filter(
        company=company
    ).delete()[0]
    return deleted


def confirm_expenses(company) -> ResetPlan:
    plan = dry_run_expenses(company)
    with transaction.atomic():
        plan.deleted_counts = _delete_expenses(company)
        plan.recalculation = {
            "money_accounts_updated": rebuild_money_account_balances(company),
        }
    return plan


def dry_run_quotations(company) -> ResetPlan:
    plan = ResetPlan(danger_level="medium")
    plan.affected_counts = {
        "quotations": _count(Quotation.objects.filter(company=company)),
        "quotation_lines": _count(QuotationLine.objects.filter(company=company)),
        "quotation_status_history": _count(QuotationStatusHistory.objects.filter(company=company)),
    }
    plan.side_effects = ["Quotation documents only; sales/purchases are untouched"]
    return plan


def confirm_quotations(company) -> ResetPlan:
    plan = dry_run_quotations(company)
    with transaction.atomic():
        plan.deleted_counts = {
            "quotation_status_history": QuotationStatusHistory.objects.filter(
                company=company
            ).delete()[0],
            "quotation_lines": QuotationLine.objects.filter(company=company).delete()[0],
            "quotations": Quotation.objects.filter(company=company).delete()[0],
        }
    return plan


def dry_run_inventory(company) -> ResetPlan:
    plan = ResetPlan(danger_level="critical")
    if has_posted_sales(company) or has_posted_purchases(company):
        return block_inventory(plan)
    plan.affected_counts = {
        "stock_movements": _count(StockMovement.objects.filter(company=company)),
        "fifo_layers": _count(FIFOStockLayer.objects.filter(company=company)),
        "inventory_balances": _count(InventoryBalance.objects.filter(company=company)),
        "stock_adjustments": _count(StockAdjustment.objects.filter(company=company)),
        "stocktaking_sessions": _count(StocktakingSession.objects.filter(company=company)),
        "valuation_snapshots": _count(
            InventoryValuationSnapshot.objects.filter(company=company)
        ),
    }
    plan.side_effects = ["All stock quantities and FIFO costing for this company will be cleared"]
    return plan


def confirm_inventory(company) -> ResetPlan:
    plan = dry_run_inventory(company)
    if not plan.can_reset:
        return plan
    with transaction.atomic():
        deleted = {}
        deleted["stocktaking_lines"] = StocktakingLine.objects.filter(
            company=company
        ).delete()[0]
        deleted["stock_movements"] = StockMovement.objects.filter(company=company).delete()[0]
        deleted["stocktaking_sessions"] = StocktakingSession.objects.filter(
            company=company
        ).delete()[0]
        deleted["stock_adjustments"] = StockAdjustment.objects.filter(
            company=company
        ).delete()[0]
        deleted["valuation_snapshots"] = InventoryValuationSnapshot.objects.filter(
            company=company
        ).delete()[0]
        deleted["fifo_layers"] = FIFOStockLayer.objects.filter(company=company).delete()[0]
        deleted["inventory_balances"] = InventoryBalance.objects.filter(
            company=company
        ).delete()[0]
        plan.deleted_counts = deleted
    return plan


def dry_run_customers(company) -> ResetPlan:
    plan = ResetPlan(danger_level="high")
    if customers_blocked(company):
        return block_customers(plan)
    plan.affected_counts = {
        "customers": _count(Customer.objects.filter(company=company)),
        "customer_categories": _count(CustomerCategory.objects.filter(company=company)),
        "customer_special_prices": _count(CustomerSpecialPrice.objects.filter(company=company)),
        "customer_free_agreements": _count(
            CustomerFreeProductAgreement.objects.filter(company=company)
        ),
        "customer_credit_changes": _count(
            CustomerCreditLimitChange.objects.filter(company=company)
        ),
        "customer_ledger_entries": _count(
            CustomerLedgerEntry.objects.filter(company=company)
        ),
    }
    plan.side_effects = ["All customer master data for this company will be removed"]
    return plan


def confirm_customers(company) -> ResetPlan:
    plan = dry_run_customers(company)
    if not plan.can_reset:
        return plan
    with transaction.atomic():
        deleted = {}
        deleted["customer_credit_changes"] = CustomerCreditLimitChange.objects.filter(
            company=company
        ).delete()[0]
        deleted["customer_free_agreements"] = CustomerFreeProductAgreement.objects.filter(
            company=company
        ).delete()[0]
        deleted["customer_special_prices"] = CustomerSpecialPrice.objects.filter(
            company=company
        ).delete()[0]
        deleted["customer_ledger_entries"] = CustomerLedgerEntry.objects.filter(
            company=company
        ).delete()[0]
        deleted["customers"] = Customer.objects.filter(company=company).delete()[0]
        deleted["customer_categories"] = CustomerCategory.objects.filter(
            company=company
        ).delete()[0]
        plan.deleted_counts = deleted
    return plan


def dry_run_suppliers(company) -> ResetPlan:
    plan = ResetPlan(danger_level="high")
    if suppliers_blocked(company):
        return block_suppliers(plan)
    plan.affected_counts = {
        "suppliers": _count(Supplier.objects.filter(company=company)),
        "supplier_categories": _count(SupplierCategory.objects.filter(company=company)),
        "supplier_special_prices": _count(SupplierSpecialPrice.objects.filter(company=company)),
        "supplier_agreements": _count(SupplierAgreement.objects.filter(company=company)),
        "supplier_ledger_entries": _count(SupplierLedgerEntry.objects.filter(company=company)),
    }
    plan.side_effects = ["All supplier master data for this company will be removed"]
    return plan


def confirm_suppliers(company) -> ResetPlan:
    plan = dry_run_suppliers(company)
    if not plan.can_reset:
        return plan
    with transaction.atomic():
        deleted = {}
        deleted["supplier_agreements"] = SupplierAgreement.objects.filter(
            company=company
        ).delete()[0]
        deleted["supplier_special_prices"] = SupplierSpecialPrice.objects.filter(
            company=company
        ).delete()[0]
        deleted["supplier_ledger_entries"] = SupplierLedgerEntry.objects.filter(
            company=company
        ).delete()[0]
        deleted["suppliers"] = Supplier.objects.filter(company=company).delete()[0]
        deleted["supplier_categories"] = SupplierCategory.objects.filter(
            company=company
        ).delete()[0]
        plan.deleted_counts = deleted
    return plan


def dry_run_products(company) -> ResetPlan:
    plan = ResetPlan(danger_level="high")
    if has_product_references(company):
        return block_products(plan)
    plan.affected_counts = {
        "products": _count(Product.objects.filter(company=company)),
        "product_categories": _count(ProductCategory.objects.filter(company=company)),
    }
    plan.side_effects = ["Product catalog for this company will be removed"]
    return plan


def confirm_products(company) -> ResetPlan:
    plan = dry_run_products(company)
    if not plan.can_reset:
        return plan
    with transaction.atomic():
        plan.deleted_counts = {
            "products": Product.objects.filter(company=company).delete()[0],
            "product_categories": ProductCategory.objects.filter(company=company).delete()[0],
        }
    return plan


def dry_run_tax(company) -> ResetPlan:
    plan = ResetPlan(danger_level="medium")
    closed = TaxPeriod.objects.filter(company=company, status=TaxPeriodStatus.CLOSED).count()
    plan.affected_counts = {
        "tax_warnings": _count(TaxWarning.objects.filter(company=company)),
        "tax_adjustments": _count(TaxAdjustment.objects.filter(company=company)),
        "tax_periods_open": _count(
            TaxPeriod.objects.filter(company=company).exclude(status=TaxPeriodStatus.CLOSED)
        ),
        "tax_periods_closed_skipped": closed,
    }
    plan.side_effects = [
        "Closed tax periods are preserved and not deleted",
        "Sales/purchase/expense transactions are not deleted",
    ]
    return plan


def confirm_tax(company) -> ResetPlan:
    plan = dry_run_tax(company)
    with transaction.atomic():
        plan.deleted_counts = {
            "tax_warnings": TaxWarning.objects.filter(company=company).delete()[0],
            "tax_adjustments": TaxAdjustment.objects.filter(company=company).delete()[0],
            "tax_periods": TaxPeriod.objects.filter(company=company).exclude(
                status=TaxPeriodStatus.CLOSED
            ).delete()[0],
        }
    return plan


def dry_run_reports(company) -> ResetPlan:
    plan = ResetPlan(danger_level="low")
    snapshots = _count(InventoryValuationSnapshot.objects.filter(company=company))
    plan.affected_counts = {"inventory_valuation_snapshots": snapshots} if snapshots else {}
    if snapshots == 0:
        plan.side_effects = [
            "Reports are calculated from live data. No transaction data will be deleted.",
        ]
    else:
        plan.side_effects = [
            "Stored inventory valuation snapshots will be deleted",
            "Live transactional reports recalculate automatically from remaining data",
        ]
    return plan


def confirm_reports(company) -> ResetPlan:
    plan = dry_run_reports(company)
    with transaction.atomic():
        plan.deleted_counts = {
            "inventory_valuation_snapshots": InventoryValuationSnapshot.objects.filter(
                company=company
            ).delete()[0],
        }
    return plan


def dry_run_treasury(company) -> ResetPlan:
    plan = ResetPlan(danger_level="high")
    if treasury_blocked(company):
        return block_treasury(plan)
    plan.affected_counts = {
        "money_movements": _count(MoneyMovement.objects.filter(company=company)),
        "money_accounts": _count(MoneyAccount.objects.filter(company=company)),
    }
    plan.side_effects = ["All cashbox/bank accounts and movements will be deleted"]
    return plan


def confirm_treasury(company) -> ResetPlan:
    plan = dry_run_treasury(company)
    if not plan.can_reset:
        return plan
    with transaction.atomic():
        plan.deleted_counts = {
            "money_movements": MoneyMovement.objects.filter(company=company).delete()[0],
            "money_accounts": MoneyAccount.objects.filter(company=company).delete()[0],
        }
    return plan


DRY_RUN_HANDLERS: dict[str, Callable] = {
    "sales": dry_run_sales,
    "purchases": dry_run_purchases,
    "payments": dry_run_payments,
    "expenses": dry_run_expenses,
    "quotations": dry_run_quotations,
    "inventory": dry_run_inventory,
    "customers": dry_run_customers,
    "suppliers": dry_run_suppliers,
    "products": dry_run_products,
    "tax": dry_run_tax,
    "reports": dry_run_reports,
    "treasury": dry_run_treasury,
}

CONFIRM_HANDLERS: dict[str, Callable] = {
    "sales": confirm_sales,
    "purchases": confirm_purchases,
    "payments": confirm_payments,
    "expenses": confirm_expenses,
    "quotations": confirm_quotations,
    "inventory": confirm_inventory,
    "customers": confirm_customers,
    "suppliers": confirm_suppliers,
    "products": confirm_products,
    "tax": confirm_tax,
    "reports": confirm_reports,
    "treasury": confirm_treasury,
}
