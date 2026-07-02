"""Sensitive action registry + risk levels.

Future modules (sales, purchases, inventory, ...) call into the audit service
using these codes. For this phase we only define the registry and enforcement
helper; the actions themselves are implemented in later phases.
"""

from django.db import models


class RiskLevel(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


# code -> default risk level. Every code here REQUIRES a reason when performed.
SENSITIVE_ACTIONS = {
    "edit_sales_price": RiskLevel.HIGH,
    "edit_purchase_price": RiskLevel.HIGH,
    "override_kg": RiskLevel.HIGH,
    "approve_invoice": RiskLevel.MEDIUM,
    "cancel_sales_invoice": RiskLevel.HIGH,
    "cancel_purchase_invoice": RiskLevel.HIGH,
    "collection_discount": RiskLevel.HIGH,
    "credit_limit_increase": RiskLevel.HIGH,
    "edit_customer_opening_balance": RiskLevel.HIGH,
    "edit_supplier_opening_balance": RiskLevel.HIGH,
    "manual_stock_adjustment": RiskLevel.HIGH,
    "stocktaking_apply": RiskLevel.HIGH,
    "opening_inventory": RiskLevel.MEDIUM,
    "inventory_correction": RiskLevel.HIGH,
    "vat_rate_change": RiskLevel.HIGH,
    "vat_disabled": RiskLevel.HIGH,
    "numbering_change": RiskLevel.MEDIUM,
    "print_template_change": RiskLevel.LOW,
    "permission_change": RiskLevel.HIGH,
    "user_suspend": RiskLevel.MEDIUM,
    "financial_report_export": RiskLevel.MEDIUM,
    "receipt_cancel": RiskLevel.HIGH,
    "expense_cancel": RiskLevel.MEDIUM,
    # --- Phase 2: products / customers / suppliers (reason-required) ---
    "product_price_change": RiskLevel.HIGH,
    "product_carton_rule_change": RiskLevel.HIGH,
    "product_disable": RiskLevel.MEDIUM,
    "customer_credit_limit_change": RiskLevel.HIGH,
    "customer_special_price_change": RiskLevel.MEDIUM,
    "supplier_special_price_change": RiskLevel.MEDIUM,
    "supplier_agreement_change": RiskLevel.MEDIUM,
    "customer_disable_with_balance": RiskLevel.HIGH,
    "supplier_disable_with_balance": RiskLevel.HIGH,
    # --- Phase 4: purchase invoices (reason-required) ---
    "approve_purchase_invoice": RiskLevel.MEDIUM,
    "override_purchase_price": RiskLevel.HIGH,
    "purchase_adjustment_change": RiskLevel.MEDIUM,
    "vat_change_on_purchase": RiskLevel.HIGH,
    # --- Phase 5: sales invoices (reason-required) ---
    "approve_sales_invoice": RiskLevel.MEDIUM,
    "override_sales_price": RiskLevel.HIGH,
    "override_kg": RiskLevel.HIGH,
    "free_product_override": RiskLevel.HIGH,
    "credit_limit_override": RiskLevel.HIGH,
    "collection_adjustment": RiskLevel.HIGH,
    "vat_change_on_sales": RiskLevel.HIGH,
    "invoice_discount": RiskLevel.MEDIUM,
    # --- Phase 6: payments (reason-required) ---
    "customer_refund": RiskLevel.HIGH,
    "supplier_refund": RiskLevel.HIGH,
    "payment_cancel": RiskLevel.HIGH,
    # --- Phase 7: quotations (reason-required) ---
    "reject_quotation": RiskLevel.MEDIUM,
    "cancel_quotation": RiskLevel.HIGH,
    "convert_quotation_to_sales": RiskLevel.MEDIUM,
    "override_quotation_price": RiskLevel.HIGH,
    # --- Phase 8: expenses (reason-required) ---
    "create_purchase_linked_expense": RiskLevel.MEDIUM,
    # --- Phase 9: tax/VAT (reason-required) ---
    "tax_warning_dismiss": RiskLevel.MEDIUM,
    "tax_adjustment_create": RiskLevel.HIGH,
    "tax_adjustment_cancel": RiskLevel.HIGH,
    "tax_report_export": RiskLevel.MEDIUM,
    # --- Phase 10: reports & analytics ---
    "report_export": RiskLevel.MEDIUM,
    "profit_report_view": RiskLevel.MEDIUM,
    "tax_report_view": RiskLevel.MEDIUM,
    "inventory_valuation_view": RiskLevel.MEDIUM,
}

# Non-reason-required purchase actions still recorded via create_audit_log:
#   supplier_invoice_upload (attachment uploads).

# Non-reason-required actions still worth recording (use create_audit_log):
#   product_reactivate, customer_reactivate, supplier_reactivate,
#   customer_free_product_change, supplier_agreement_change (non-financial).


def is_sensitive_action(action_code: str) -> bool:
    return action_code in SENSITIVE_ACTIONS


def risk_for_action(action_code: str) -> str:
    return SENSITIVE_ACTIONS.get(action_code, RiskLevel.LOW)
