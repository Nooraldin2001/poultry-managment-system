"""Phase 10 reports & analytics tests."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.customers.models import Customer, CustomerType
from apps.expenses import services as expense_services
from apps.expenses.models import ExpenseCategory, ExpenseCategoryType, ExpenseStatus
from apps.inventory import services as inventory_services
from apps.inventory.models import MovementType, StockSourceType
from apps.payments import services as payment_services
from apps.payments.models import MoneyAccount, PaymentMovementType
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseLineType, PurchaseStatus
from apps.quotations import services as quotation_services
from apps.quotations.models import QuotationLineType, QuotationStatus
from apps.reports import services
from apps.sales import services as sales_services
from apps.sales.models import SalesLineType, SalesStatus
from apps.suppliers.models import Supplier, SupplierType

pytestmark = pytest.mark.django_db

DASHBOARD_URL = "/api/v1/tenant/reports/dashboard/"


_treasury_seq = 0


def _treasury_account(company, payment_method="cash"):
    global _treasury_seq
    _treasury_seq += 1
    account_type = "bank" if payment_method in ("bank_transfer", "cheque") else "cashbox"
    return MoneyAccount.objects.create(
        company=company,
        name=f"Treasury {account_type} {_treasury_seq}",
        account_type=account_type,
        opening_balance=Decimal("10000"),
        current_balance=Decimal("10000"),
        currency="AED",
        is_active=True,
    )


SALES_URL = "/api/v1/tenant/reports/sales/"
PURCHASES_URL = "/api/v1/tenant/reports/purchases/"
INVENTORY_URL = "/api/v1/tenant/reports/inventory/"
MOVEMENTS_URL = "/api/v1/tenant/reports/inventory-movements/"
PAYMENTS_URL = "/api/v1/tenant/reports/payments/"
EXPENSES_URL = "/api/v1/tenant/reports/expenses/"
PROFIT_URL = "/api/v1/tenant/reports/profit/"
TAX_BRIDGE_URL = "/api/v1/tenant/reports/tax-summary/"
EXPORT_URL = "/api/v1/tenant/reports/export-payload/"


def _customer(company, **kwargs):
    defaults = dict(
        company=company, name_ar="عميل", phone="0500000001",
        customer_type=CustomerType.CREDIT, credit_limit=Decimal("50000"),
    )
    defaults.update(kwargs)
    return Customer.objects.create(**defaults)


def _supplier(company, **kwargs):
    defaults = dict(
        company=company, name_ar="مورد", phone="0500000002",
        supplier_type=SupplierType.CREDIT,
    )
    defaults.update(kwargs)
    return Supplier.objects.create(**defaults)


def _product(company, sku="RPT1"):
    cat = ProductCategory.objects.create(
        company=company, name_ar=f"cat-{sku}", code=f"C{sku}",
    )
    return Product.objects.create(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("100"),
        purchase_price=Decimal("10"), can_sell=True,
    )


def _seed_stock(company, owner, product, kg="100"):
    inventory_services.add_stock(
        company=company, product=product, kg=Decimal(kg),
        unit_cost_per_kg=Decimal("8"),
        source_type=StockSourceType.OPENING_INVENTORY,
        reason="opening", user=owner,
        movement_type=MovementType.OPENING_INVENTORY,
    )


def _approved_sale(company, owner, customer=None, product=None, qty="10"):
    customer = customer or _customer(company)
    product = product or _product(company)
    _seed_stock(company, owner, product)
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal(qty), "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="approve")
    inv.refresh_from_db()
    return inv, customer, product


def _approved_purchase(company, owner, supplier=None, product=None):
    supplier = supplier or _supplier(company)
    product = product or _product(company, sku="PUR")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("50"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="approve")
    inv.refresh_from_db()
    return inv, supplier, product


def _posted_expense(company, owner):
    cat = ExpenseCategory.objects.create(
        company=company, name_ar="نقل", code="TRN", category_type=ExpenseCategoryType.DAILY,
    )
    return expense_services.create_expense(
        company=company, category=cat, created_by=owner,
        title="Transport", expense_date=date.today(),
        amount=Decimal("200"), vat_rate=Decimal("5"),
        money_account=_treasury_account(company, "cash"),
    )


# ── Dashboard ─────────────────────────────────────────────────────────────────
def test_dashboard_empty_tenant_returns_zeros(company, owner):
    data = services.get_dashboard_summary(company)
    assert data["total_sales"] == 0
    assert data["sales_invoice_count"] == 0
    assert data["sales_trend"] == []


def test_dashboard_includes_approved_sales_excludes_draft(company, owner):
    inv, _, _ = _approved_sale(company, owner)
    customer = _customer(company, phone="0502")
    product = _product(company, sku="DRF")
    sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("5"), "price_type": "kg",
        }],
    )
    data = services.get_dashboard_summary(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert data["sales_invoice_count"] == 1
    assert data["total_sales"] == inv.total_amount
    assert data["gross_profit"] == inv.gross_profit


def test_dashboard_excludes_cancelled_sale(company, owner):
    inv, _, _ = _approved_sale(company, owner)
    sales_services.cancel_sales_invoice(invoice=inv, user=owner, reason="mistake")
    data = services.get_dashboard_summary(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert data["sales_invoice_count"] == 0
    assert data["total_sales"] == 0


def test_dashboard_default_date_range_is_current_month(company, owner):
    data = services.get_dashboard_summary(company)
    today = date.today()
    assert data["date_from"] == str(today.replace(day=1))
    assert data["date_to"] == str(today)


# ── Sales report ──────────────────────────────────────────────────────────────
def test_sales_report_totals_and_fifo_profit(company, owner):
    inv, customer, _ = _approved_sale(company, owner)
    report = services.get_sales_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 1
    assert report["totals"]["total_amount"] == inv.total_amount
    assert report["totals"]["fifo_cost_total"] == inv.fifo_cost_total
    assert report["totals"]["gross_profit"] == inv.gross_profit
    assert report["breakdowns"]["by_customer"][0]["customer_id"] == customer.id


def test_sales_report_filters_by_customer(company, owner):
    inv1, c1, product = _approved_sale(company, owner)
    _approved_sale(company, owner, customer=_customer(company, phone="0503"), product=product)
    report = services.get_sales_report(
        company, date_from=date.today(), date_to=date.today(),
        filters={"customer": c1.id},
    )
    assert report["totals"]["invoice_count"] == 1
    assert report["records"][0]["id"] == inv1.id


def test_sales_report_excludes_cancelled(company, owner):
    inv, _, _ = _approved_sale(company, owner)
    sales_services.cancel_sales_invoice(invoice=inv, user=owner, reason="x")
    report = services.get_sales_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 0


# ── Purchase report ───────────────────────────────────────────────────────────
def test_purchase_report_includes_approved(company, owner):
    inv, supplier, _ = _approved_purchase(company, owner)
    report = services.get_purchase_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 1
    assert report["totals"]["total_amount"] == inv.total_amount
    assert report["breakdowns"]["by_supplier"][0]["supplier_id"] == supplier.id


def test_purchase_report_excludes_draft(company, owner):
    _approved_purchase(company, owner)
    supplier = _supplier(company, phone="0504")
    product = _product(company, sku="DRP")
    purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    report = services.get_purchase_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["invoice_count"] == 1


# ── Inventory report ──────────────────────────────────────────────────────────
def test_inventory_report_returns_fifo_value(company, owner):
    _, _, product = _approved_sale(company, owner)
    report = services.get_inventory_report(company)
    assert report["totals"]["total_kg"] > 0
    assert report["totals"]["total_fifo_value"] > 0
    assert any(r["product_id"] == product.id for r in report["balances"])


def test_inventory_movement_report_inbound_outbound(company, owner):
    _approved_sale(company, owner, qty="5")
    report = services.get_inventory_movement_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["inbound_kg"] > 0
    assert report["totals"]["outbound_kg"] > 0


# ── Customer statement ───────────────────────────────────────────────────────
def test_customer_statement_opening_and_closing(company, owner):
    inv, customer, _ = _approved_sale(company, owner)
    payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("200"),
        payment_method="cash", user=owner, money_account=_treasury_account(company, "cash"),
        allocations=[{"sales_invoice": inv, "allocated_amount": Decimal("200")}],
    )
    stmt = services.get_customer_statement(
        company, customer,
        date_from=date.today(), date_to=date.today(),
    )
    customer.refresh_from_db()
    assert stmt["debit_total"] > 0
    assert stmt["credit_total"] == Decimal("200.00")
    assert stmt["closing_balance"] == services.get_customer_balance(customer)
    assert len(stmt["open_sales_invoices"]) >= 1


def test_customer_statement_cross_tenant_blocked(company, other_company):
    customer = _customer(other_company)
    with pytest.raises(ValidationError):
        services.get_customer_statement(company, customer)


def test_customer_aging_buckets(company, owner):
    inv, customer, _ = _approved_sale(company, owner)
    inv.due_date = date.today() - timedelta(days=45)
    inv.save(update_fields=["due_date"])
    aging = services.get_customers_aging_report(company)
    row = next(r for r in aging["customers"] if r["customer_id"] == customer.id)
    assert Decimal(row["aging_buckets"]["31_60_days"]) > 0


# ── Supplier statement ────────────────────────────────────────────────────────
def test_supplier_statement_balances(company, owner):
    inv, supplier, _ = _approved_purchase(company, owner)
    stmt = services.get_supplier_statement(
        company, supplier,
        date_from=date.today(), date_to=date.today(),
    )
    supplier.refresh_from_db()
    assert stmt["credit_total"] > 0
    assert stmt["closing_balance"] == services.get_supplier_balance(supplier)
    assert len(stmt["open_purchase_invoices"]) >= 1


def test_supplier_statement_cross_tenant_blocked(company, other_company):
    supplier = _supplier(other_company)
    with pytest.raises(ValidationError):
        services.get_supplier_statement(company, supplier)


# ── Payments report ───────────────────────────────────────────────────────────
def test_payments_report_collections(company, owner):
    inv, customer, _ = _approved_sale(company, owner)
    payment_services.record_customer_collection(
        company=company, customer=customer, amount=Decimal("300"),
        payment_method="cash", user=owner, money_account=_treasury_account(company, "cash"),
        allocations=[{"sales_invoice": inv, "allocated_amount": Decimal("300")}],
    )
    report = services.get_payments_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["customer_collections"] == Decimal("300.00")
    assert report["breakdowns"]["by_payment_method"]


# ── Expenses report ───────────────────────────────────────────────────────────
def test_expenses_report_posted_only(company, owner):
    exp = _posted_expense(company, owner)
    report = services.get_expenses_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["expense_count"] == 1
    assert report["totals"]["total_amount"] == exp.total_amount


def test_expenses_report_excludes_cancelled(company, owner):
    exp = _posted_expense(company, owner)
    expense_services.cancel_expense(expense=exp, user=owner, reason="mistake")
    report = services.get_expenses_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["expense_count"] == 0


# ── Profit report ─────────────────────────────────────────────────────────────
def test_profit_report_fifo_gross_minus_expenses(company, owner):
    inv, _, _ = _approved_sale(company, owner)
    exp = _posted_expense(company, owner)
    report = services.get_profit_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["gross_profit"] == inv.gross_profit
    assert report["net_profit_foundation"] == inv.gross_profit - exp.total_amount
    assert report["gross_margin_percentage"] >= 0


def test_profit_report_ignores_quotations(company, owner):
    customer = _customer(company)
    product = _product(company, sku="Q")
    quotation_services.create_quotation(
        company=company, customer=customer, created_by=owner,
        quotation_date=date.today(), valid_until=date.today() + timedelta(days=7),
        lines=[{
            "product": product, "line_type": QuotationLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "price_type": "kg",
        }],
    )
    report = services.get_profit_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["sales_total"] == 0


# ── Tax bridge ────────────────────────────────────────────────────────────────
def test_tax_summary_bridge_available(company, owner):
    _approved_sale(company, owner)
    bridge = services.get_tax_summary_bridge(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert bridge["available"] is True
    assert "net_vat" in bridge


def test_no_vat_purchase_has_zero_input_vat_in_tax_bridge(company, owner):
    supplier = _supplier(company, trn="")
    product = _product(company, sku="TAX0")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("50"), "unit_price": Decimal("10"),
            "price_type": "kg", "vat_rate": Decimal("0"),
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="approve")
    bridge = services.get_tax_summary_bridge(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert bridge["available"] is True
    assert bridge["input_vat"] == Decimal("0")


# ── Export payload ────────────────────────────────────────────────────────────
def test_export_payload_structure(company, owner):
    _approved_sale(company, owner)
    payload = services.build_export_payload(
        company, report_type="sales",
        date_from=date.today(), date_to=date.today(), user=owner,
    )
    assert payload["metadata"]["report_type"] == "sales"
    assert payload["company"]["name_ar"]
    assert "records" in payload["report"]
    assert AuditLog.objects.filter(action="report_export", company=company).exists()


# ── API permissions ───────────────────────────────────────────────────────────
def test_owner_can_access_dashboard(api, owner):
    api.force_authenticate(user=owner)
    resp = api.get(DASHBOARD_URL)
    assert resp.status_code == 200


def test_accountant_can_access_profit(api, accountant):
    api.force_authenticate(user=accountant)
    resp = api.get(PROFIT_URL, {"date_from": str(date.today()), "date_to": str(date.today())})
    assert resp.status_code == 200


def test_cashier_cannot_access_profit(api, cashier):
    api.force_authenticate(user=cashier)
    resp = api.get(PROFIT_URL, {"date_from": str(date.today()), "date_to": str(date.today())})
    assert resp.status_code == 403


def test_cashier_can_access_limited_dashboard(api, cashier):
    api.force_authenticate(user=cashier)
    resp = api.get(DASHBOARD_URL)
    assert resp.status_code == 200


def test_cashier_cannot_export(api, cashier):
    api.force_authenticate(user=cashier)
    resp = api.get(EXPORT_URL, {
        "report_type": "sales",
        "date_from": str(date.today()),
        "date_to": str(date.today()),
    })
    assert resp.status_code == 403


def test_cross_tenant_customer_statement_api_blocked(api, owner, other_company):
    customer = _customer(other_company)
    api.force_authenticate(user=owner)
    resp = api.get(
        f"/api/v1/tenant/reports/customers/{customer.id}/statement/",
        {"date_from": str(date.today()), "date_to": str(date.today())},
    )
    assert resp.status_code == 404


def test_sales_report_api_requires_dates(api, owner):
    api.force_authenticate(user=owner)
    resp = api.get(SALES_URL)
    assert resp.status_code == 400
