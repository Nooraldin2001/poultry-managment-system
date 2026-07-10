"""Treasury / Accounts module integration tests."""

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.customers.models import Customer, CustomerType
from apps.expenses import services as expense_services
from apps.expenses.models import ExpenseCategory, ExpenseCategoryType, ExpenseScope
from apps.inventory import services as inventory_services
from apps.inventory.models import MovementType, StockSourceType
from apps.payments import services as payment_services
from apps.payments.models import MoneyAccount, MoneyMovement, MoneyMovementType
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseLineType
from apps.sales import services as sales_services
from apps.sales.models import SalesLineType
from apps.suppliers.models import Supplier, SupplierType

pytestmark = pytest.mark.django_db

MONEY_ACCOUNTS_URL = "/api/v1/tenant/money-accounts/"
TRANSFER_URL = "/api/v1/tenant/treasury/transfer/"


def _money_account(company, *, name="Main Cash", account_type="cashbox", opening="1000"):
    return MoneyAccount.objects.create(
        company=company,
        name=name,
        account_type=account_type,
        opening_balance=Decimal(opening),
        current_balance=Decimal(opening),
        currency="AED",
        is_active=True,
    )


def _customer(company):
    return Customer.objects.create(
        company=company, name_ar="عميل", phone="0500000001",
        customer_type=CustomerType.CREDIT, credit_limit=Decimal("50000"),
    )


def _supplier(company):
    return Supplier.objects.create(
        company=company, name_ar="مورد", phone="0500000002",
        supplier_type=SupplierType.CREDIT,
    )


def _product(company, sku="ACC1"):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    return Product.objects.create(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("100"),
        purchase_price=Decimal("10"), can_sell=True,
    )


def _seed_stock(company, owner, product, kg="100"):
    inventory_services.add_stock(
        company=company, product=product, kg=Decimal(kg),
        unit_cost_per_kg=Decimal("10"),
        source_type=StockSourceType.OPENING_INVENTORY,
        reason="opening", user=owner,
        movement_type=MovementType.OPENING_INVENTORY,
    )


def _expense_category(company):
    return ExpenseCategory.objects.create(
        company=company, name_ar="مصروف", name_en="Expense",
        code="ACC", category_type=ExpenseCategoryType.DAILY, is_active=True,
    )


# 1–2: create cashbox / bank with opening balance
def test_create_cashbox_with_opening_balance(api, owner):
    api.force_authenticate(owner)
    res = api.post(
        MONEY_ACCOUNTS_URL,
        {"name": "Store Cash", "account_type": "cashbox", "opening_balance": "10000.00"},
        format="json",
    )
    assert res.status_code == 201, res.data
    account = MoneyAccount.objects.get(pk=res.data["id"])
    assert account.current_balance == Decimal("10000.00")
    assert MoneyMovement.objects.filter(
        money_account=account,
        movement_type=MoneyMovementType.OPENING_BALANCE,
    ).exists()


def test_create_bank_account_with_opening_balance(api, owner):
    api.force_authenticate(owner)
    res = api.post(
        MONEY_ACCOUNTS_URL,
        {
            "name": "ENBD",
            "account_type": "bank",
            "bank_name": "ENBD",
            "opening_balance": "20000.00",
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    account = MoneyAccount.objects.get(pk=res.data["id"])
    assert account.account_type == "bank"
    assert account.current_balance == Decimal("20000.00")


# 3: statement shows opening movement
def test_statement_shows_opening_movement(api, owner):
    api.force_authenticate(owner)
    res = api.post(
        MONEY_ACCOUNTS_URL,
        {"name": "Statement Cash", "account_type": "cashbox", "opening_balance": "5000.00"},
        format="json",
    )
    assert res.status_code == 201, res.data
    account_id = res.data["id"]
    res = api.get(f"{MONEY_ACCOUNTS_URL}{account_id}/statement/")
    assert res.status_code == 200, res.data
    assert Decimal(res.data["opening_balance"]) == Decimal("5000.00")
    assert any(
        m["movement_type"] == MoneyMovementType.OPENING_BALANCE
        for m in res.data["movements"]
    )


# 4: adjustment updates current balance
def test_adjustment_updates_current_balance(api, owner):
    account = _money_account(owner.company, opening="1000")
    api.force_authenticate(owner)
    res = api.post(
        f"{MONEY_ACCOUNTS_URL}{account.id}/adjustments/",
        {"direction": "in", "amount": "250.00", "reason": "count correction"},
        format="json",
    )
    assert res.status_code == 201, res.data
    account.refresh_from_db()
    assert account.current_balance == Decimal("1250.00")


# 5: transfer creates two movements
def test_transfer_creates_two_movements(api, owner):
    cashbox = _money_account(owner.company, name="Cash A", opening="5000")
    bank = _money_account(owner.company, name="Bank A", account_type="bank", opening="20000")
    api.force_authenticate(owner)
    res = api.post(
        TRANSFER_URL,
        {
            "from_account": cashbox.id,
            "to_account": bank.id,
            "amount": "1000.00",
            "reason": "deposit to bank",
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    cashbox.refresh_from_db()
    bank.refresh_from_db()
    assert cashbox.current_balance == Decimal("4000.00")
    assert bank.current_balance == Decimal("21000.00")
    assert MoneyMovement.objects.filter(
        movement_type=MoneyMovementType.ACCOUNT_TRANSFER,
    ).count() == 2
    assert AuditLog.objects.filter(company=owner.company, action="treasury_transfer").exists()


# 6: account with movements cannot hard delete
def test_account_with_movements_cannot_delete(api, owner):
    account = _money_account(owner.company)
    payment_services.post_money_movement(
        company=owner.company,
        money_account=account,
        movement_type=MoneyMovementType.MANUAL_ADJUSTMENT,
        direction="in",
        amount=Decimal("10"),
        reason="seed",
        user=owner,
    )
    api.force_authenticate(owner)
    res = api.delete(f"{MONEY_ACCOUNTS_URL}{account.id}/")
    assert res.status_code == 400


# 7: tenant isolation
def test_money_account_tenant_isolation(api, owner, other_owner):
    account = _money_account(owner.company)
    api.force_authenticate(other_owner)
    assert api.get(f"{MONEY_ACCOUNTS_URL}{account.id}/").status_code == 404
    assert api.get(f"{MONEY_ACCOUNTS_URL}{account.id}/statement/").status_code == 404


# 8–9: purchase integrations
def test_cash_purchase_deducts_cashbox(company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PCASH")
    cashbox = _money_account(company, opening="1000")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        payment_method="cash", amount_paid=Decimal("60"),
        money_account=cashbox,
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="cash")
    cashbox.refresh_from_db()
    assert cashbox.current_balance == Decimal("940.00")


def test_bank_purchase_deducts_bank(company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PBANK")
    bank = _money_account(company, name="Bank", account_type="bank", opening="500")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        payment_method="bank_transfer", amount_paid=Decimal("25"),
        money_account=bank,
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="bank")
    bank.refresh_from_db()
    assert bank.current_balance == Decimal("475.00")


# 10–11: sales integrations
def test_cash_sale_increases_cashbox(company, owner):
    customer = _customer(company)
    product = _product(company, sku="SCASH")
    cashbox = _money_account(company, opening="1000")
    _seed_stock(company, owner, product)
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        payment_method="cash", amount_paid=Decimal("100"),
        money_account=cashbox,
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="cash sale")
    cashbox.refresh_from_db()
    assert cashbox.current_balance == Decimal("1100.00")


def test_bank_sale_increases_bank(company, owner):
    customer = _customer(company)
    product = _product(company, sku="SBANK")
    bank = _money_account(company, name="Bank", account_type="bank", opening="500")
    _seed_stock(company, owner, product)
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        payment_method="bank_transfer", amount_paid=Decimal("50"),
        money_account=bank,
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("5"), "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="bank sale")
    bank.refresh_from_db()
    assert bank.current_balance == Decimal("550.00")


# 12–13: payment integrations
def test_customer_collection_increases_account(company, owner):
    customer = _customer(company)
    cashbox = _money_account(company, opening="1000")
    payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("200"),
        payment_method="cash", user=owner, money_account=cashbox,
    )
    cashbox.refresh_from_db()
    assert cashbox.current_balance == Decimal("1200.00")


def test_supplier_payment_decreases_account(company, owner):
    supplier = _supplier(company)
    bank = _money_account(company, name="Bank", account_type="bank", opening="1000")
    payment_services.record_supplier_payment(
        company=company, supplier=supplier, amount=Decimal("150"),
        payment_method="bank_transfer", user=owner, money_account=bank,
    )
    bank.refresh_from_db()
    assert bank.current_balance == Decimal("850.00")


# 14: expense payment decreases account
def test_expense_payment_decreases_account(company, owner):
    cashbox = _money_account(company, opening="2000")
    cat = _expense_category(company)
    expense_services.create_expense(
        company=company, category=cat, created_by=owner,
        title="Fuel", expense_date=date.today(), amount=Decimal("80"),
        expense_scope=ExpenseScope.DAILY,
        payment_method="cash", money_account=cashbox,
    )
    cashbox.refresh_from_db()
    assert cashbox.current_balance == Decimal("1920.00")
    assert MoneyMovement.objects.filter(
        movement_type=MoneyMovementType.EXPENSE_PAYMENT,
        money_account=cashbox,
    ).exists()


# 15: wrong account type rejected
def test_wrong_account_type_rejected_for_cash_purchase(company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="WRONG")
    bank = _money_account(company, name="Bank", account_type="bank", opening="500")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        payment_method="cash", amount_paid=Decimal("10"),
        money_account=bank,
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("1"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    with pytest.raises(ValidationError):
        purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="bad")
