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


# ── VAT: applied once (ex-VAT unit price, footer VAT separate) ───────────────
def test_purchase_kg_line_subtotal_before_vat(company, owner):
    """7.5 kg × 13.75 = 103.13 before VAT (client-reported duplication case)."""
    supplier = _supplier(company, "PVAT1")
    product = _product(company, "PVAT1", purchase_price=Decimal("13.75"))
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": "7.5", "unit_price": "13.75", "price_type": "kg",
        }],
    )
    line = inv.lines.first()
    assert line.line_subtotal == Decimal("103.12")
    assert line.vat_amount == Decimal("5.16")
    assert line.line_total == Decimal("108.28")
    assert inv.subtotal == Decimal("103.12")
    assert inv.vat_amount == Decimal("5.16")
    assert inv.gross_total == Decimal("108.28")


def test_purchase_vat_disabled_has_zero_vat(company, owner):
    supplier = _supplier(company, "PVAT0")
    product = _product(company, "PVAT0")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": "10", "unit_price": "12", "price_type": "kg",
        }],
    )
    line = inv.lines.first()
    assert line.vat_amount == Decimal("0.00")
    assert line.line_total == line.line_subtotal == Decimal("120.00")
    assert inv.vat_amount == Decimal("0.00")
    assert inv.gross_total == Decimal("120.00")


def test_purchase_print_preview_line_total_excludes_vat_when_footer_vat(company, owner, api):
    supplier = _supplier(company, "PPVAT")
    product = _product(company, "PPVAT", purchase_price=Decimal("13.75"))
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": "7.5", "unit_price": "13.75", "price_type": "kg",
        }],
    )
    preview = build_purchase_print_preview(inv)
    pline = preview["lines"][0]
    assert Decimal(pline["display_total"]) == Decimal("103.12")
    assert Decimal(pline["line_subtotal"]) == Decimal("103.12")
    assert Decimal(pline["line_total"]) == Decimal("108.28")
    assert Decimal(preview["totals"]["vat_amount"]) == Decimal("5.16")
    assert Decimal(preview["totals"]["gross_total"]) == Decimal("108.28")

    api.force_authenticate(owner)
    resp = api.get(f"{PURCHASES_URL}{inv.id}/print-preview/")
    assert resp.status_code == 200
    api_line = resp.data["lines"][0]
    assert Decimal(api_line["display_total"]) == Decimal("103.12")
    assert Decimal(resp.data["totals"]["vat_amount"]) == Decimal("5.16")


def test_purchase_deductions_apply_after_gross_total(company, owner):
    from apps.suppliers.models import SupplierCategory

    supplier = _supplier(company, "PDED")
    slaughter_cat, _ = SupplierCategory.objects.get_or_create(
        company=company, code="slaughterhouse",
        defaults={"name_ar": "مسلخ", "name_en": "slaughterhouse"},
    )
    transport_cat, _ = SupplierCategory.objects.get_or_create(
        company=company, code="transport",
        defaults={"name_ar": "نقل", "name_en": "transport"},
    )
    slaughter = Supplier.objects.create(
        company=company, name_ar="مسلخ", phone="0501111",
        supplier_type=SupplierType.CREDIT, category=slaughter_cat,
    )
    transport = Supplier.objects.create(
        company=company, name_ar="نقل", phone="0502222",
        supplier_type=SupplierType.CREDIT, category=transport_cat,
    )
    product = _product(company, "PDED")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        slaughterhouse_supplier=slaughter,
        slaughterhouse_deduction_amount=Decimal("10"),
        transport_supplier=transport,
        transport_deduction_amount=Decimal("5"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": "10", "unit_price": "100", "price_type": "kg",
        }],
    )
    assert inv.gross_total == Decimal("1050.00")  # 1000 + 5% VAT
    assert inv.total_amount == Decimal("1035.00")  # gross - 15 deductions


def test_sales_kg_line_subtotal_before_vat(company, owner):
    customer = _customer(company, phone="0505555001")
    product = _product(company, "SVAT1", sales_price=Decimal("13.75"))
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": "7.5", "unit_price": "13.75", "price_type": "kg",
        }],
    )
    line = inv.lines.first()
    assert line.line_subtotal == Decimal("103.12")
    assert line.vat_amount == Decimal("5.16")
    assert line.line_total == Decimal("108.28")
    assert inv.subtotal == Decimal("103.12")
    assert inv.vat_amount == Decimal("5.16")
    assert inv.total_amount == Decimal("108.28")


def test_sales_vat_disabled_has_zero_vat(company, owner):
    customer = _customer(company, phone="0505555002")
    product = _product(company, "SVAT0", sales_price=Decimal("12"))
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": "10", "unit_price": "12", "price_type": "kg",
        }],
    )
    line = inv.lines.first()
    assert line.vat_amount == Decimal("0.00")
    assert line.line_total == line.line_subtotal == Decimal("120.00")
    assert inv.vat_amount == Decimal("0.00")
    assert inv.total_amount == Decimal("120.00")


def test_sales_print_preview_line_total_excludes_vat_when_footer_vat(company, owner, api):
    customer = _customer(company, phone="0505555003")
    product = _product(company, "SPVAT", sales_price=Decimal("13.75"))
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": "7.5", "unit_price": "13.75", "price_type": "kg",
        }],
    )
    preview = build_print_preview(inv)
    pline = preview["lines"][0]
    assert Decimal(pline["display_total"]) == Decimal("103.12")
    assert Decimal(pline["line_subtotal"]) == Decimal("103.12")
    assert Decimal(pline["line_total"]) == Decimal("108.28")
    assert Decimal(preview["totals"]["vat_amount"]) == Decimal("5.16")
    assert Decimal(preview["totals"]["total_amount"]) == Decimal("108.28")

    api.force_authenticate(owner)
    resp = api.get(f"{SALES_URL}{inv.id}/print-preview/")
    assert resp.status_code == 200
    assert Decimal(resp.data["lines"][0]["display_total"]) == Decimal("103.12")
    assert Decimal(resp.data["totals"]["vat_amount"]) == Decimal("5.16")


def test_tax_report_uses_corrected_purchase_vat(company, owner):
    from apps.tax import services as tax_services

    supplier = _supplier(company, "TRPT")
    product = _product(company, "TRPT")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": "7.5", "unit_price": "13.75", "price_type": "kg",
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    report = tax_services.get_purchase_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["purchase_vat_amount"] == inv.vat_amount == Decimal("5.16")


def test_tax_report_uses_corrected_sales_vat(company, owner):
    from apps.inventory import services as inventory_services
    from apps.inventory.models import StockSourceType
    from apps.tax import services as tax_services

    customer = _customer(company, phone="0505555004")
    product = _product(company, "TRSL", sales_price=Decimal("13.75"))
    inventory_services.add_stock(
        company=company, product=product, kg=Decimal("100"),
        unit_cost_per_kg=Decimal("8"), source_type=StockSourceType.OPENING_INVENTORY,
        source_id=0, source_reference="opening", reason="stock", user=owner,
    )
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": "7.5", "unit_price": "13.75", "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    report = tax_services.get_sales_vat_report(
        company, date_from=date.today(), date_to=date.today(),
    )
    assert report["totals"]["sales_vat_amount"] == inv.vat_amount == Decimal("5.16")


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
    assert Decimal(preview["lines"][0]["display_total"]) == Decimal("1200.00")


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
    assert Decimal(preview["lines"][0]["display_total"]) == Decimal("1000.00")


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
