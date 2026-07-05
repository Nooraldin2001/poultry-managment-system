"""Tests for tenant-scoped demo data hygiene commands."""

import pytest
from django.core.management import CommandError, call_command

from apps.customers.models import Customer
from apps.products.models import Product, ProductCategory
from apps.tenants.models import Company

pytestmark = pytest.mark.django_db


def test_purge_tenant_demo_data_dry_run(company, owner):
    cat = ProductCategory.objects.create(
        company=company, name_ar="فئة", code="CAT1", sort_order=1
    )
    Product.objects.create(
        company=company, category=cat, name_ar="Gulf Restaurant", sku="SKU1"
    )
    Customer.objects.create(
        company=company, name_ar="Smoke Test Customer", phone="+971500000001"
    )
    Customer.objects.create(
        company=company, name_ar="FIRST VIEW GENERAL TRADING", phone="+971500000002"
    )

    call_command(
        "purge_tenant_demo_data",
        company_subdomain=company.subdomain,
        dry_run=True,
    )
    assert Customer.objects.filter(company=company).count() == 2
    assert Product.objects.filter(company=company).count() == 1


def test_purge_tenant_demo_data_deletes_only_demo_like(company, owner):
    demo = Customer.objects.create(
        company=company, name_ar="Smoke Test Customer", phone="+971500000001"
    )
    real = Customer.objects.create(
        company=company, name_ar="FIRST VIEW GENERAL TRADING", phone="+971500000002"
    )

    call_command(
        "purge_tenant_demo_data",
        company_subdomain=company.subdomain,
        confirm_delete_demo_data=True,
    )
    assert not Customer.objects.filter(pk=demo.pk).exists()
    assert Customer.objects.filter(pk=real.pk).exists()


def test_purge_tenant_demo_purchases_dry_run(company, owner):
    from datetime import date

    from apps.purchases.models import PurchaseInvoice, PurchaseStatus
    from apps.suppliers.models import Supplier

    demo_supplier = Supplier.objects.create(
        company=company, name_ar="WESTLAND FOODSTUFF", phone="+971500000001"
    )
    PurchaseInvoice.objects.create(
        company=company,
        supplier=demo_supplier,
        supplier_name_snapshot="WESTLAND FOODSTUFF",
        invoice_number="PUR-2025-0042",
        supplier_invoice_number="WST-2025-1234",
        invoice_date=date.today(),
        status=PurchaseStatus.DRAFT,
    )
    call_command(
        "purge_tenant_demo_data",
        company_subdomain=company.subdomain,
        module="purchases",
        dry_run=True,
    )
    assert PurchaseInvoice.objects.filter(company=company).count() == 1


def test_purge_tenant_demo_payments_dry_run(company, owner):
    from datetime import date

    from apps.payments.models import PartyType, PaymentMovement, PaymentMovementStatus, PaymentMovementType
    from apps.customers.models import Customer

    demo_customer = Customer.objects.create(
        company=company, name_ar="مطعم الخليج", phone="+971500000001"
    )
    PaymentMovement.objects.create(
        company=company,
        movement_number="MOV-DEMO-1",
        receipt_number="REC-DEMO-1",
        movement_type=PaymentMovementType.CUSTOMER_COLLECTION,
        party_type=PartyType.CUSTOMER,
        customer=demo_customer,
        movement_date=date.today(),
        payment_method="cash",
        amount="100.00",
        status=PaymentMovementStatus.POSTED,
        posted_by=owner,
    )
    call_command(
        "purge_tenant_demo_data",
        company_subdomain=company.subdomain,
        module="payments",
        dry_run=True,
    )
    assert PaymentMovement.objects.filter(company=company).count() == 1


def test_purge_tenant_demo_expenses_dry_run(company, owner):
    from datetime import date
    from decimal import Decimal

    from apps.expenses.models import Expense, ExpenseCategory, ExpenseCategoryType, ExpenseStatus, RecurringExpense

    from apps.expenses import services as expense_services

    cat = ExpenseCategory.objects.create(
        company=company, name_ar="إيجار السكن", code="RENT", category_type=ExpenseCategoryType.MONTHLY,
    )
    expense_services.create_expense(
        company=company, category=cat, created_by=owner,
        title="إيجار السكن", expense_date=date.today(), amount=Decimal("4500.00"),
    )
    RecurringExpense.objects.create(
        company=company,
        category=cat,
        title="رواتب",
        amount=Decimal("18000.00"),
        total_amount=Decimal("18000.00"),
        recurrence="monthly",
        start_date=date.today(),
        next_due_date=date.today(),
        created_by=owner,
    )
    expense_services.create_expense(
        company=company, category=cat, created_by=owner,
        title="FIRST VIEW OFFICE SUPPLIES", expense_date=date.today(), amount=Decimal("120.00"),
    )

    call_command(
        "purge_tenant_demo_data",
        company_subdomain=company.subdomain,
        module="expenses",
        dry_run=True,
    )
    assert Expense.objects.filter(company=company).count() == 2
    assert RecurringExpense.objects.filter(company=company).count() == 1


def test_purge_tenant_demo_expenses_confirm_deletes_only_demo(company, owner):
    from datetime import date
    from decimal import Decimal

    from apps.expenses.models import Expense, ExpenseCategory, ExpenseCategoryType, ExpenseStatus, RecurringExpense

    from apps.expenses import services as expense_services

    cat = ExpenseCategory.objects.create(
        company=company, name_ar="إيجار السكن", code="RENT2", category_type=ExpenseCategoryType.MONTHLY,
    )
    demo = expense_services.create_expense(
        company=company, category=cat, created_by=owner,
        title="إيجار السيارات", expense_date=date.today(), amount=Decimal("2300.00"),
    )
    real = expense_services.create_expense(
        company=company, category=cat, created_by=owner,
        title="FIRST VIEW OFFICE SUPPLIES", expense_date=date.today(), amount=Decimal("120.00"),
    )
    demo_recurring = RecurringExpense.objects.create(
        company=company,
        category=cat,
        title="اشتراك نظام",
        amount=Decimal("350.00"),
        total_amount=Decimal("350.00"),
        recurrence="monthly",
        start_date=date.today(),
        next_due_date=date.today(),
        created_by=owner,
    )

    call_command(
        "purge_tenant_demo_data",
        company_subdomain=company.subdomain,
        module="expenses",
        confirm_delete_demo_data=True,
    )
    assert not Expense.objects.filter(pk=demo.pk).exists()
    assert Expense.objects.filter(pk=real.pk).exists()
    assert not RecurringExpense.objects.filter(pk=demo_recurring.pk).exists()


def test_reset_tenant_operational_data_dry_run(company, owner):
    cat = ProductCategory.objects.create(
        company=company, name_ar="فئة", code="CAT1", sort_order=1
    )
    Product.objects.create(
        company=company, category=cat, name_ar="منتج", sku="SKU1"
    )
    call_command(
        "reset_tenant_operational_data",
        company_subdomain=company.subdomain,
        dry_run=True,
    )
    assert Company.objects.filter(pk=company.pk).exists()
    assert Product.objects.filter(company=company).count() == 1


def test_reset_tenant_operational_data_requires_confirmation(company, owner):
    cat = ProductCategory.objects.create(
        company=company, name_ar="فئة", code="CAT1", sort_order=1
    )
    Product.objects.create(
        company=company, category=cat, name_ar="منتج", sku="SKU1"
    )
    call_command(
        "reset_tenant_operational_data",
        company_subdomain=company.subdomain,
    )
    assert Product.objects.filter(company=company).count() == 1

    call_command(
        "reset_tenant_operational_data",
        company_subdomain=company.subdomain,
        confirm_reset_empty_tenant=True,
    )
    assert Product.objects.filter(company=company).count() == 0
    assert Company.objects.filter(pk=company.pk).exists()
