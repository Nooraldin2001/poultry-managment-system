from django.db import models


class DocumentType(models.TextChoices):
    SALES_INVOICE = "sales_invoice", "Sales Invoice"
    PURCHASE_INVOICE = "purchase_invoice", "Purchase Invoice"
    QUOTATION = "quotation", "Quotation"
    CUSTOMER_RECEIPT = "customer_receipt", "Customer Receipt"
    SUPPLIER_PAYMENT_RECEIPT = "supplier_payment_receipt", "Supplier Payment Receipt"
    EXPENSE_VOUCHER = "expense_voucher", "Expense Voucher"
    COLLECTION_ADJUSTMENT = "collection_adjustment", "Collection Adjustment"
    STOCK_ADJUSTMENT = "stock_adjustment", "Stock Adjustment"
    CUSTOMER_REFUND = "customer_refund", "Customer Refund"
    SUPPLIER_REFUND = "supplier_refund", "Supplier Refund"


class TemplateType(models.TextChoices):
    SALES_TAX_INVOICE = "sales_tax_invoice", "Sales Tax Invoice"
    QUOTATION = "quotation", "Quotation"
    PURCHASE_INTERNAL_RECORD = "purchase_internal_record", "Purchase Internal Record"
    CUSTOMER_RECEIPT = "customer_receipt", "Customer Receipt"
    SUPPLIER_PAYMENT_RECEIPT = "supplier_payment_receipt", "Supplier Payment Receipt"
    EXPENSE_VOUCHER = "expense_voucher", "Expense Voucher"
    CUSTOMER_STATEMENT = "customer_statement", "Customer Statement"
    SUPPLIER_STATEMENT = "supplier_statement", "Supplier Statement"
    DAILY_REPORT = "daily_report", "Daily Report"
    VAT_REPORT = "vat_report", "VAT Report"


class ResetRule(models.TextChoices):
    NONE = "none", "Never"
    MONTHLY = "monthly", "Monthly"
    YEARLY = "yearly", "Yearly"


class PaperSize(models.TextChoices):
    A4 = "a4", "A4"
    A5 = "a5", "A5"
    THERMAL_80 = "thermal_80", "Thermal 80mm"
