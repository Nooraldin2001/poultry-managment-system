"""Invoice line deletion tests (client blocker: Method "DELETE" not allowed).

DELETE /api/v1/tenant/purchases/{id}/lines/{line_id}/
DELETE /api/v1/tenant/sales/{id}/lines/{line_id}/

Rules: only draft invoices allow line deletion; totals are recalculated by the
backend after deletion; whole invoices can never be hard-deleted (405).
"""

from datetime import date
from decimal import Decimal

import pytest

from apps.inventory import services as inventory_services
from apps.inventory.models import MovementType, StockSourceType
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseLineType
from apps.sales import services as sales_services
from apps.sales.models import SalesLineType
from apps.customers.models import Customer, CustomerType
from apps.suppliers.models import Supplier, SupplierType

pytestmark = pytest.mark.django_db

SALES_URL = "/api/v1/tenant/sales/"
PURCHASES_URL = "/api/v1/tenant/purchases/"


def _supplier(company):
    return Supplier.objects.create(
        company=company, name_ar="مورد", phone="0500000010",
        supplier_type=SupplierType.CREDIT,
    )


def _customer(company):
    return Customer.objects.create(
        company=company, name_ar="عميل", phone="0500000011",
        customer_type=CustomerType.CREDIT, credit_limit=Decimal("100000"),
    )


def _product(company, sku="DEL1"):
    cat = ProductCategory.objects.create(company=company, name_ar=f"c{sku}", code=f"C{sku}")
    return Product.objects.create(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, purchase_price=Decimal("10.00"),
        sales_price=Decimal("20.00"), can_sell=True,
    )


def _purchase_with_two_lines(company, owner):
    supplier = _supplier(company)
    p1 = _product(company, sku="DELP1")
    p2 = _product(company, sku="DELP2")
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[
            {"product": p1, "line_type": PurchaseLineType.PRODUCT,
             "quantity_kg": Decimal("10"), "unit_price": Decimal("10"),
             "price_type": "kg"},
            {"product": p2, "line_type": PurchaseLineType.PRODUCT,
             "quantity_kg": Decimal("5"), "unit_price": Decimal("10"),
             "price_type": "kg"},
        ],
    )
    return inv


def _sales_with_two_lines(company, owner):
    customer = _customer(company)
    p1 = _product(company, sku="DELS1")
    p2 = _product(company, sku="DELS2")
    for prod in (p1, p2):
        inventory_services.add_stock(
            company=company, product=prod, kg=Decimal("100"),
            unit_cost_per_kg=Decimal("5"),
            source_type=StockSourceType.OPENING_INVENTORY,
            reason="opening", user=owner,
            movement_type=MovementType.OPENING_INVENTORY,
        )
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), vat_rate=Decimal("0"),
        lines=[
            {"product": p1, "line_type": SalesLineType.PRODUCT,
             "quantity_kg": Decimal("10"), "price_type": "kg",
             "unit_price": Decimal("20")},
            {"product": p2, "line_type": SalesLineType.PRODUCT,
             "quantity_kg": Decimal("5"), "price_type": "kg",
             "unit_price": Decimal("20")},
        ],
    )
    return inv


# ── Purchases ────────────────────────────────────────────────────────────────
def test_delete_purchase_draft_line_recalculates_totals(api, company, owner):
    inv = _purchase_with_two_lines(company, owner)
    assert inv.subtotal == Decimal("150.00")
    line = inv.lines.first()
    api.force_authenticate(owner)
    resp = api.delete(f"{PURCHASES_URL}{inv.id}/lines/{line.id}/")
    assert resp.status_code == 204, getattr(resp, "data", resp)
    inv.refresh_from_db()
    assert inv.lines.count() == 1
    assert inv.subtotal == Decimal("50.00")
    assert inv.total_amount == Decimal("50.00")


def test_delete_line_on_approved_purchase_blocked(api, company, owner):
    inv = _purchase_with_two_lines(company, owner)
    line = inv.lines.first()
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    api.force_authenticate(owner)
    resp = api.delete(f"{PURCHASES_URL}{inv.id}/lines/{line.id}/")
    assert resp.status_code == 400
    inv.refresh_from_db()
    assert inv.lines.count() == 2


def test_purchase_invoice_hard_delete_blocked(api, company, owner):
    inv = _purchase_with_two_lines(company, owner)
    api.force_authenticate(owner)
    resp = api.delete(f"{PURCHASES_URL}{inv.id}/")
    assert resp.status_code == 405


def test_cashier_cannot_delete_purchase_line(api, company, owner, cashier):
    inv = _purchase_with_two_lines(company, owner)
    line = inv.lines.first()
    api.force_authenticate(cashier)
    resp = api.delete(f"{PURCHASES_URL}{inv.id}/lines/{line.id}/")
    assert resp.status_code == 403
    inv.refresh_from_db()
    assert inv.lines.count() == 2


def test_cross_tenant_purchase_line_delete_blocked(api, company, owner, other_owner):
    inv = _purchase_with_two_lines(company, owner)
    line = inv.lines.first()
    api.force_authenticate(other_owner)
    resp = api.delete(f"{PURCHASES_URL}{inv.id}/lines/{line.id}/")
    assert resp.status_code == 404
    inv.refresh_from_db()
    assert inv.lines.count() == 2


# ── Sales ────────────────────────────────────────────────────────────────────
def test_delete_sales_draft_line_recalculates_totals(api, company, owner):
    inv = _sales_with_two_lines(company, owner)
    assert inv.subtotal == Decimal("300.00")
    line = inv.lines.first()
    api.force_authenticate(owner)
    resp = api.delete(f"{SALES_URL}{inv.id}/lines/{line.id}/")
    assert resp.status_code == 204, getattr(resp, "data", resp)
    inv.refresh_from_db()
    assert inv.lines.count() == 1
    assert inv.subtotal == Decimal("100.00")


def test_delete_line_on_approved_sales_blocked(api, company, owner):
    inv = _sales_with_two_lines(company, owner)
    line = inv.lines.first()
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    api.force_authenticate(owner)
    resp = api.delete(f"{SALES_URL}{inv.id}/lines/{line.id}/")
    assert resp.status_code == 400
    inv.refresh_from_db()
    assert inv.lines.count() == 2


def test_sales_invoice_hard_delete_blocked(api, company, owner):
    inv = _sales_with_two_lines(company, owner)
    api.force_authenticate(owner)
    resp = api.delete(f"{SALES_URL}{inv.id}/")
    assert resp.status_code == 405


def test_cashier_cannot_delete_sales_line(api, company, owner, cashier):
    inv = _sales_with_two_lines(company, owner)
    line = inv.lines.first()
    api.force_authenticate(cashier)
    resp = api.delete(f"{SALES_URL}{inv.id}/lines/{line.id}/")
    assert resp.status_code == 403
    inv.refresh_from_db()
    assert inv.lines.count() == 2
