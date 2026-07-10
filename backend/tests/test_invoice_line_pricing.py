"""Cross-module invoice line pricing: price_type drives quantity basis."""

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.core.line_pricing import normalize_price_type
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseLineType
from apps.purchases.services import build_purchase_print_preview
from apps.reports import services as report_services
from apps.sales import services as sales_services
from apps.sales.models import SalesLineType, SalesStatus
from apps.sales.services import build_print_preview
from apps.suppliers.models import Supplier, SupplierType

pytestmark = pytest.mark.django_db

PURCHASES_URL = "/api/v1/tenant/purchases/"
SALES_URL = "/api/v1/tenant/sales/"


def _customer(company, **kwargs):
    from apps.customers.models import Customer, CustomerType

    defaults = dict(
        company=company, name_ar="عميل", phone="0501111001",
        customer_type=CustomerType.CREDIT, credit_limit=Decimal("50000"),
    )
    defaults.update(kwargs)
    return Customer.objects.create(**defaults)


def _supplier(company, sku="SUP"):
    return Supplier.objects.create(
        company=company, name_ar=f"مورد {sku}", phone=f"050{sku[-4:]}",
        supplier_type=SupplierType.CREDIT,
    )


def _product(company, sku="PRD", **kwargs):
    cat = ProductCategory.objects.create(
        company=company, name_ar=f"cat-{sku}", code=f"C{sku}",
    )
    defaults = dict(
        company=company, category=cat, name_ar=f"prod {sku}", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("12.00"),
        purchase_price=Decimal("10.00"), can_sell=True, can_purchase=True,
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _seed_stock(company, owner, product, kg="500"):
    from apps.inventory import services as inventory_services
    from apps.inventory.models import MovementType, StockSourceType

    inventory_services.add_stock(
        company=company, product=product, kg=Decimal(kg),
        unit_cost_per_kg=Decimal("8"), source_type=StockSourceType.OPENING_INVENTORY,
        reason="opening", user=owner, movement_type=MovementType.OPENING_INVENTORY,
    )


# ── normalize_price_type ─────────────────────────────────────────────────────
def test_normalize_price_type_defaults_and_rejects_invalid():
    assert normalize_price_type(None) == "kg"
    assert normalize_price_type("  KG ") == "kg"
    assert normalize_price_type("carton") == "carton"
    with pytest.raises(ValueError, match="Invalid price_type"):
        normalize_price_type("invalid")


# ── Purchase: price_type quantity basis ──────────────────────────────────────
def test_purchase_kg_line_uses_kg_not_pieces(company, owner):
    supplier = _supplier(company, "PK1")
    product = _product(company, "PK1")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_cartons": "10", "quantity_pieces": "100",
            "quantity_kg": "3344.8", "unit_price": "14.5", "price_type": "kg",
        }],
    )
    line = inv.lines.first()
    assert line.line_subtotal == (Decimal("3344.8") * Decimal("14.5")).quantize(Decimal("0.01"))


def test_purchase_piece_line_uses_pieces(company, owner):
    supplier = _supplier(company, "PP1")
    product = _product(company, "PP1")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_pieces": "40", "quantity_kg": "100",
            "unit_price": "3", "price_type": "piece",
        }],
    )
    assert inv.lines.first().line_subtotal == Decimal("120.00")


def test_purchase_carton_line_uses_cartons(company, owner):
    supplier = _supplier(company, "PC1")
    product = _product(company, "PC1")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_cartons": "15", "quantity_pieces": "150",
            "quantity_kg": "150", "unit_price": "40", "price_type": "carton",
        }],
    )
    assert inv.lines.first().line_subtotal == Decimal("600.00")


def test_purchase_invalid_price_type_rejected_via_api(api, company, owner):
    supplier = _supplier(company, "PI1")
    product = _product(company, "PI1")
    api.force_authenticate(owner)
    resp = api.post(
        PURCHASES_URL,
        {
            "supplier": supplier.id,
            "invoice_date": str(date.today()),
            "vat_rate": "0",
            "lines": [{
                "product": product.id, "line_type": "product",
                "quantity_kg": "10", "unit_price": "5", "price_type": "bad",
            }],
        },
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["lines"][0]["price_type"]


# ── Sales: price_type quantity basis ─────────────────────────────────────────
def test_sales_kg_line_uses_kg_not_pieces(company, owner):
    customer = _customer(company)
    product = _product(company, "SK1", sales_price=Decimal("14.5"))
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_cartons": "5", "quantity_pieces": "50",
            "quantity_kg": "200", "unit_price": "14.5", "price_type": "kg",
        }],
    )
    line = inv.lines.first()
    assert line.line_subtotal == Decimal("2900.00")


def test_sales_piece_line_uses_pieces(company, owner):
    customer = _customer(company)
    product = _product(company, "SP1", sales_price=Decimal("4"))
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_pieces": "25", "quantity_kg": "80",
            "unit_price": "4", "price_type": "piece",
        }],
    )
    assert inv.lines.first().line_subtotal == Decimal("100.00")


def test_sales_carton_line_uses_cartons(company, owner):
    customer = _customer(company)
    product = _product(company, "SC1", sales_price=Decimal("50"))
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_cartons": "12", "quantity_pieces": "120",
            "quantity_kg": "120", "unit_price": "50", "price_type": "carton",
        }],
    )
    assert inv.lines.first().line_subtotal == Decimal("600.00")


def test_sales_invalid_price_type_rejected_via_api(api, company, owner):
    customer = _customer(company, phone="0502222001")
    product = _product(company, "SI1")
    api.force_authenticate(owner)
    resp = api.post(
        SALES_URL,
        {
            "customer": customer.id,
            "invoice_date": str(date.today()),
            "vat_rate": "0",
            "lines": [{
                "product": product.id, "line_type": "product",
                "quantity_kg": "10", "unit_price": "5", "price_type": "bogus",
            }],
        },
        format="json",
    )
    assert resp.status_code == 400
    assert resp.data["lines"][0]["price_type"]


# ── Print preview uses backend line totals ───────────────────────────────────
def test_purchase_print_preview_kg_line_total(api, company, owner):
    supplier = _supplier(company, "PPV1")
    product = _product(company, "PPV1")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": "100", "quantity_pieces": "999",
            "unit_price": "12", "price_type": "kg",
        }],
    )
    api.force_authenticate(owner)
    resp = api.get(f"{PURCHASES_URL}{inv.id}/print-preview/")
    assert resp.status_code == 200
    line = resp.data["lines"][0]
    assert line["price_type"] == "kg"
    assert Decimal(line["line_subtotal"]) == Decimal("1200.00")
    assert Decimal(line["line_total"]) == Decimal("1200.00")
    preview = build_purchase_print_preview(inv)
    assert Decimal(preview["lines"][0]["line_total"]) == Decimal("1200.00")


def test_sales_print_preview_kg_line_total(api, company, owner):
    customer = _customer(company, phone="0503333001")
    product = _product(company, "SPV1", sales_price=Decimal("20"))
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": "50", "quantity_pieces": "500",
            "unit_price": "20", "price_type": "kg",
        }],
    )
    api.force_authenticate(owner)
    resp = api.get(f"{SALES_URL}{inv.id}/print-preview/")
    assert resp.status_code == 200
    line = resp.data["lines"][0]
    assert line["price_type"] == "kg"
    assert Decimal(line["line_subtotal"]) == Decimal("1000.00")
    preview = build_print_preview(inv)
    assert Decimal(preview["lines"][0]["line_total"]) == Decimal("1000.00")


# ── Reports / profit use corrected invoice totals ────────────────────────────
def test_reports_profit_uses_kg_priced_sales_line(company, owner):
    customer = _customer(company, phone="0504444001")
    product = _product(company, "RPTKG", sales_price=Decimal("100"))
    _seed_stock(company, owner, product, kg="100")
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": "10", "quantity_pieces": "0", "quantity_cartons": "0",
            "unit_price": "100", "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    assert inv.lines.first().line_subtotal == Decimal("1000.00")
    assert inv.status == SalesStatus.APPROVED

    sales_report = report_services.get_sales_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert sales_report["totals"]["total_amount"] == inv.total_amount
    assert sales_report["totals"]["gross_profit"] == inv.gross_profit

    profit_report = report_services.get_profit_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert profit_report["gross_profit"] == inv.gross_profit
