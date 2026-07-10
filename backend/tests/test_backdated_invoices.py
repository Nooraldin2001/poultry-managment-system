"""Backdated invoice policy tests (sales + purchases)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.inventory import services as inventory_services
from apps.inventory.models import FIFOStockLayer, MovementType, StockMovement, StockSourceType
from apps.purchases import services as purchase_services
from apps.purchases.models import PurchaseLineType, PurchaseStatus
from apps.reports import services as report_services
from apps.sales import services as sales_services
from apps.sales.models import SalesLineType, SalesStatus
from apps.customers.models import Customer, CustomerLedgerEntry, CustomerType
from apps.suppliers.models import Supplier, SupplierLedgerEntry, SupplierType
from apps.products.models import Product, ProductCategory, ProductType

pytestmark = pytest.mark.django_db

SALES_URL = "/api/v1/tenant/sales/"
PURCHASES_URL = "/api/v1/tenant/purchases/"


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


def _product(company, sku="BD1", **kwargs):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    defaults = dict(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("100"),
        purchase_price=Decimal("10"), can_sell=True,
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _seed_stock(company, owner, product, kg="100"):
    inventory_services.add_stock(
        company=company, product=product, kg=Decimal(kg),
        unit_cost_per_kg=Decimal("8"),
        source_type=StockSourceType.OPENING_INVENTORY,
        reason="opening", user=owner,
        movement_type=MovementType.OPENING_INVENTORY,
    )


def _sales_payload(customer, product, invoice_date, **overrides):
    data = {
        "customer": customer.id,
        "invoice_date": str(invoice_date),
        "vat_rate": "0",
        "lines": [{
            "product": product.id, "line_type": "product",
            "quantity_kg": "10", "price_type": "kg",
        }],
    }
    data.update(overrides)
    return data


def _purchase_payload(supplier, product, invoice_date, **overrides):
    data = {
        "supplier": supplier.id,
        "invoice_date": str(invoice_date),
        "vat_rate": "0",
        "lines": [{
            "product": product.id, "line_type": "product",
            "quantity_kg": "50", "unit_price": "10", "price_type": "kg",
        }],
    }
    data.update(overrides)
    return data


# ── Sales backdating ──────────────────────────────────────────────────────────
def test_owner_can_create_backdated_sales_with_reason(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    past = date.today() - timedelta(days=3)
    api.force_authenticate(owner)
    resp = api.post(
        SALES_URL,
        _sales_payload(customer, product, past, backdate_reason="Late entry"),
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["invoice_date"] == str(past)
    assert resp.data["backdate_reason"] == "Late entry"
    assert AuditLog.objects.filter(
        company=company, action="backdate_sales_invoice",
        reference_id=str(resp.data["id"]),
    ).exists()


def test_cashier_cannot_create_backdated_sales(api, company, cashier):
    customer = _customer(company)
    product = _product(company)
    past = date.today() - timedelta(days=2)
    api.force_authenticate(cashier)
    resp = api.post(
        SALES_URL,
        _sales_payload(customer, product, past, backdate_reason="Late entry"),
        format="json",
    )
    assert resp.status_code == 403


def test_backdated_sales_without_reason_fails(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    past = date.today() - timedelta(days=2)
    api.force_authenticate(owner)
    resp = api.post(SALES_URL, _sales_payload(customer, product, past), format="json")
    assert resp.status_code == 400
    assert "backdate_reason" in resp.data


def test_future_sales_date_fails(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    future = date.today() + timedelta(days=1)
    api.force_authenticate(owner)
    resp = api.post(
        SALES_URL,
        _sales_payload(customer, product, future, backdate_reason="x"),
        format="json",
    )
    assert resp.status_code == 400
    assert "invoice_date" in resp.data


def test_backdated_sales_approval_uses_invoice_date_for_stock(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    past = date.today() - timedelta(days=5)
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=past, backdate_reason="Late documents",
        vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("5"), "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="approve")
    inv.refresh_from_db()
    movement = StockMovement.objects.filter(
        company=company, reference_type="sales_invoice", reference_id=inv.id,
    ).first()
    assert movement is not None
    assert movement.movement_date == past
    assert inv.created_at.date() == date.today()
    ledger = CustomerLedgerEntry.objects.filter(
        customer=customer, reference_type="sales_invoice", reference_id=str(inv.id),
    ).first()
    assert ledger.entry_date == past


def test_sales_report_includes_backdated_invoice_by_invoice_date(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    past = date.today() - timedelta(days=7)
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=past, backdate_reason="Late",
        vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("5"), "price_type": "kg",
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="approve")
    report = report_services.get_sales_report(company, date_from=past, date_to=past)
    assert report["totals"]["invoice_count"] >= 1
    assert any(r["id"] == inv.id for r in report["records"])


def test_approved_sales_invoice_date_read_only(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    api.force_authenticate(owner)
    resp = api.post(SALES_URL, _sales_payload(customer, product, date.today()), format="json")
    inv_id = resp.data["id"]
    api.post(f"{SALES_URL}{inv_id}/approve/", {"reason": "ok"}, format="json")
    past = date.today() - timedelta(days=2)
    resp = api.patch(
        f"{SALES_URL}{inv_id}/",
        {"invoice_date": str(past), "backdate_reason": "change"},
        format="json",
    )
    assert resp.status_code == 400


# ── Purchase backdating ───────────────────────────────────────────────────────
def test_owner_can_create_backdated_purchase_with_reason(api, company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PBD1")
    past = date.today() - timedelta(days=4)
    api.force_authenticate(owner)
    resp = api.post(
        PURCHASES_URL,
        _purchase_payload(supplier, product, past, backdate_reason="Late supplier invoice"),
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["invoice_date"] == str(past)
    assert AuditLog.objects.filter(
        company=company, action="backdate_purchase_invoice",
        reference_id=str(resp.data["id"]),
    ).exists()


def test_backdated_purchase_approval_fifo_and_stock_use_invoice_date(company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PBD2")
    past = date.today() - timedelta(days=6)
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=past, backdate_reason="Late",
        vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("20"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="approve")
    movement = StockMovement.objects.filter(
        company=company, reference_type="purchase_invoice", reference_id=inv.id,
    ).first()
    assert movement.movement_date == past
    layer = FIFOStockLayer.objects.filter(
        company=company, product=product, source_id=inv.id,
    ).first()
    assert timezone.localdate(layer.received_at) == past
    ledger = SupplierLedgerEntry.objects.filter(
        supplier=supplier, reference_type="purchase_invoice", reference_id=str(inv.id),
    ).first()
    assert ledger.entry_date == past


def test_purchase_report_includes_backdated_invoice(company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PBD3")
    past = date.today() - timedelta(days=8)
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=past, backdate_reason="Late",
        vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="approve")
    report = report_services.get_purchase_report(company, date_from=past, date_to=past)
    assert report["totals"]["invoice_count"] >= 1
    assert any(r["id"] == inv.id for r in report["records"])


def test_tax_report_uses_invoice_date(company, owner):
    customer = _customer(company)
    product = _product(company, sku="TBD1")
    _seed_stock(company, owner, product)
    past = date.today() - timedelta(days=10)
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=past, backdate_reason="Late",
        vat_rate=Decimal("5"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "price_type": "kg", "unit_price": Decimal("100"),
        }],
    )
    sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="approve")
    from apps.tax import services as tax_services
    summary = tax_services.get_tax_summary(company, date_from=past, date_to=past)
    assert summary["sales_vat"] > 0


# ── Approval of backdated invoices ────────────────────────────────────────────
def test_backdated_purchase_patch_without_duplicate_reason_ok(api, company, owner):
    """Re-saving a backdated draft must not fail when the payload omits the
    already-stored backdate_reason (the approve flow PATCHes the header first)."""
    supplier = _supplier(company)
    product = _product(company, sku="PBD10")
    past = date.today() - timedelta(days=3)
    api.force_authenticate(owner)
    resp = api.post(
        PURCHASES_URL,
        _purchase_payload(supplier, product, past, backdate_reason="متأخرة"),
        format="json",
    )
    assert resp.status_code == 201, resp.data
    inv_id = resp.data["id"]
    resp = api.patch(
        f"{PURCHASES_URL}{inv_id}/",
        {"invoice_date": str(past), "notes": "resave"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["backdate_reason"] == "متأخرة"


def test_backdated_purchase_approve_via_api(api, company, owner):
    supplier = _supplier(company)
    product = _product(company, sku="PBD11")
    past = date.today() - timedelta(days=4)
    api.force_authenticate(owner)
    resp = api.post(
        PURCHASES_URL,
        _purchase_payload(supplier, product, past, backdate_reason="متأخرة"),
        format="json",
    )
    inv_id = resp.data["id"]
    resp = api.post(
        f"{PURCHASES_URL}{inv_id}/approve/",
        {"reason": "اعتماد فاتورة بتاريخ سابق"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "approved"
    assert resp.data["invoice_date"] == str(past)


def test_frontend_style_backdated_purchase_approve_flow(api, company, owner):
    """Mimics LivePurchaseInvoiceScreen: PATCH header/lines then approve."""
    from apps.payments.models import MoneyAccount

    supplier = _supplier(company)
    product = _product(company, sku="PBD-FLOW", purchase_price_type="piece")
    past = date.today() - timedelta(days=7)
    api.force_authenticate(owner)
    resp = api.post(
        PURCHASES_URL,
        _purchase_payload(supplier, product, past, backdate_reason="سبب متأخر"),
        format="json",
    )
    assert resp.status_code == 201, resp.data
    inv_id = resp.data["id"]
    line_id = resp.data["lines"][0]["id"]
    resp = api.patch(
        f"{PURCHASES_URL}{inv_id}/",
        {
            "supplier": supplier.id,
            "invoice_date": str(past),
            "backdate_reason": "سبب متأخر",
            "payment_method": "credit",
            "money_account": None,
            "amount_paid": "0",
            "vat_rate": "0.00",
            "slaughterhouse_supplier": None,
            "slaughterhouse_deduction_amount": "0",
            "transport_supplier": None,
            "transport_deduction_amount": "0",
            "deduction_notes": "",
        },
        format="json",
    )
    assert resp.status_code == 200, resp.data
    resp = api.patch(
        f"{PURCHASES_URL}{inv_id}/lines/{line_id}/",
        {
            "quantity_cartons": "0",
            "quantity_pieces": "100",
            "quantity_kg": "0",
            "unit_price": "10",
            "price_type": "piece",
            "vat_rate": "0",
        },
        format="json",
    )
    assert resp.status_code == 200, resp.data
    resp = api.post(
        f"{PURCHASES_URL}{inv_id}/approve/",
        {"reason": "اعتماد فاتورة الشراء", "backdate_reason": "سبب متأخر"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "approved"

    cashbox = MoneyAccount.objects.create(
        company=company, name="Cash", account_type="cashbox",
        opening_balance=Decimal("1000"), current_balance=Decimal("1000"), currency="AED",
    )
    resp = api.post(
        PURCHASES_URL,
        _purchase_payload(supplier, product, past, backdate_reason="سبب كاش"),
        format="json",
    )
    inv_id2 = resp.data["id"]
    api.patch(
        f"{PURCHASES_URL}{inv_id2}/",
        {
            "payment_method": "cash",
            "money_account": cashbox.id,
            "amount_paid": "500",
            "vat_rate": "0.00",
            "backdate_reason": "سبب كاش",
        },
        format="json",
    )
    resp = api.post(
        f"{PURCHASES_URL}{inv_id2}/approve/",
        {"reason": "اعتماد كاش", "backdate_reason": "سبب كاش"},
        format="json",
    )
    assert resp.status_code == 200, resp.data


def test_backdated_sales_approve_via_api(api, company, owner):
    customer = _customer(company)
    product = _product(company, sku="SBD11")
    _seed_stock(company, owner, product)
    past = date.today() - timedelta(days=4)
    api.force_authenticate(owner)
    resp = api.post(
        SALES_URL,
        _sales_payload(customer, product, past, backdate_reason="متأخرة"),
        format="json",
    )
    inv_id = resp.data["id"]
    resp = api.post(
        f"{SALES_URL}{inv_id}/approve/",
        {"reason": "اعتماد فاتورة بتاريخ سابق"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == "approved"


def test_backdated_purchase_without_stored_reason_requires_reason_on_approve(company, owner):
    """Legacy backdated drafts with no stored reason must fail clearly, and
    approve may supply the missing backdate_reason as a fallback."""
    from apps.purchases.models import PurchaseInvoice
    from rest_framework.exceptions import ValidationError as DRFValidationError

    supplier = _supplier(company)
    product = _product(company, sku="PBD12")
    past = date.today() - timedelta(days=5)
    inv = purchase_services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=past, backdate_reason="temp",
        vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": PurchaseLineType.PRODUCT,
            "quantity_kg": Decimal("10"), "unit_price": Decimal("10"), "price_type": "kg",
        }],
    )
    # Simulate a legacy row saved without a reason.
    PurchaseInvoice.objects.filter(pk=inv.pk).update(backdate_reason="")
    inv.refresh_from_db()

    with pytest.raises(DRFValidationError):
        purchase_services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")

    inv.refresh_from_db()
    approved = purchase_services.approve_purchase_invoice(
        invoice=inv, user=owner, reason="ok", backdate_reason="سبب متأخر",
    )
    assert approved.status == PurchaseStatus.APPROVED
    assert approved.backdate_reason == "سبب متأخر"


def test_backdated_sales_without_stored_reason_requires_reason_on_approve(company, owner):
    from apps.sales.models import SalesInvoice
    from rest_framework.exceptions import ValidationError as DRFValidationError

    customer = _customer(company)
    product = _product(company, sku="SBD12")
    _seed_stock(company, owner, product)
    past = date.today() - timedelta(days=5)
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=past, backdate_reason="temp",
        vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("5"), "price_type": "kg",
        }],
    )
    SalesInvoice.objects.filter(pk=inv.pk).update(backdate_reason="")
    inv.refresh_from_db()

    with pytest.raises(DRFValidationError):
        sales_services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")

    inv.refresh_from_db()
    approved = sales_services.approve_sales_invoice(
        invoice=inv, user=owner, reason="ok", backdate_reason="سبب متأخر",
    )
    assert approved.status == SalesStatus.APPROVED
    assert approved.backdate_reason == "سبب متأخر"


def test_created_at_remains_system_timestamp(company, owner):
    customer = _customer(company)
    product = _product(company, sku="TS1")
    past = date.today() - timedelta(days=3)
    before = timezone.now()
    inv = sales_services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=past, backdate_reason="Late",
        vat_rate=Decimal("0"),
        lines=[{
            "product": product, "line_type": SalesLineType.PRODUCT,
            "quantity_kg": Decimal("1"), "price_type": "kg",
        }],
    )
    assert inv.invoice_date == past
    assert inv.created_at >= before
    assert inv.created_at.date() == date.today()
