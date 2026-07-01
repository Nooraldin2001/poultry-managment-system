"""Phase 7 quotation tests: lifecycle, conversion, no side effects, APIs."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.customers.models import (
    Customer,
    CustomerFreeProductAgreement,
    CustomerLedgerEntry,
    CustomerSpecialPrice,
    CustomerType,
)
from apps.inventory.models import InventoryBalance, StockMovement
from apps.products.models import Product, ProductCategory, ProductType
from apps.quotations import services
from apps.quotations.models import (
    Quotation,
    QuotationLineType,
    QuotationPriceSource,
    QuotationStatus,
)
from apps.sales.models import SalesInvoice, SalesStatus

pytestmark = pytest.mark.django_db

QUOTATIONS_URL = "/api/v1/tenant/quotations/"


def _customer(company, **kwargs):
    defaults = dict(
        company=company, name_ar="عميل", phone="0500000001",
        customer_type=CustomerType.CREDIT,
    )
    defaults.update(kwargs)
    return Customer.objects.create(**defaults)


def _product(company, sku="Q1", **kwargs):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    defaults = dict(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("100"),
        can_sell=True, can_quote=True,
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _line(product, **kwargs):
    data = dict(
        product=product, line_type=QuotationLineType.PRODUCT,
        quantity_cartons=Decimal("0"), quantity_pieces=Decimal("0"),
        quantity_kg=Decimal("10"), price_type="kg",
    )
    data.update(kwargs)
    return data


def _create(company, customer, owner, lines, **kwargs):
    kwargs.setdefault("vat_rate", Decimal("0"))
    kwargs.setdefault("valid_until", date.today() + timedelta(days=30))
    return services.create_quotation(
        company=company, customer=customer, created_by=owner,
        quotation_date=date.today(), lines=lines, **kwargs,
    )


# ── Creation ────────────────────────────────────────────────────────────────
def test_create_draft_no_side_effects(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])

    assert q.status == QuotationStatus.DRAFT
    assert q.quotation_number.startswith("QUO-")
    assert not CustomerLedgerEntry.objects.filter(customer=customer).exists()
    customer.refresh_from_db()
    assert customer.current_balance == Decimal("0.00")
    assert not InventoryBalance.objects.filter(company=company).exists()
    assert not StockMovement.objects.filter(company=company).exists()


def test_line_subtotal_by_kg(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("12"))
    q = _create(company, customer, owner, [_line(product, quantity_kg="100")])
    assert q.lines.first().line_subtotal == Decimal("1200.00")


def test_line_subtotal_by_piece(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("3"))
    q = _create(company, customer, owner, [
        _line(product, quantity_kg="0", quantity_pieces="50", price_type="piece"),
    ])
    assert q.lines.first().line_subtotal == Decimal("150.00")


def test_line_subtotal_by_carton(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("40"))
    q = _create(company, customer, owner, [
        _line(product, quantity_kg="0", quantity_cartons="20", price_type="carton"),
    ])
    assert q.lines.first().line_subtotal == Decimal("800.00")


def test_negative_quantity_rejected(company, owner):
    customer = _customer(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, customer, owner, [_line(product, quantity_kg="-1")])


def test_negative_price_override_rejected(company, owner):
    customer = _customer(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, customer, owner, [
            _line(product, unit_price="-5", price_source=QuotationPriceSource.MANUAL_OVERRIDE,
                  override_reason="bad"),
        ])


def test_customer_cross_tenant_rejected(company, owner, other_company):
    other_customer = _customer(other_company, phone="099")
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, other_customer, owner, [_line(product)])


def test_product_cross_tenant_rejected(company, owner, other_company):
    customer = _customer(company)
    other_product = _product(other_company, sku="OT")
    with pytest.raises(ValidationError):
        _create(company, customer, owner, [_line(other_product)])


def test_customer_special_price_applied(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("100"))
    CustomerSpecialPrice.objects.create(
        company=company, customer=customer, product=product,
        price=Decimal("85"), price_type="kg", is_active=True,
    )
    q = _create(company, customer, owner, [_line(product)])
    line = q.lines.first()
    assert line.unit_price == Decimal("85.00")
    assert line.price_source == QuotationPriceSource.CUSTOMER_SPECIAL_PRICE


def test_free_product_agreement_applied(company, owner):
    customer = _customer(company)
    product = _product(company)
    CustomerFreeProductAgreement.objects.create(
        company=company, customer=customer, product=product,
        agreement_type=CustomerFreeProductAgreement.AgreementType.ALWAYS_FREE,
        is_active=True,
    )
    q = _create(company, customer, owner, [_line(product, is_free=True)])
    line = q.lines.first()
    assert line.is_free is True
    assert line.unit_price == Decimal("0.00")


def test_manual_override_requires_permission(company, cashier):
    customer = _customer(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, customer, cashier, [
            _line(product, unit_price="50", price_source=QuotationPriceSource.MANUAL_OVERRIDE,
                  override_reason="deal"),
        ])


# ── Workflow ────────────────────────────────────────────────────────────────
def test_send_quotation(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    services.send_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    assert q.status == QuotationStatus.SENT
    assert q.sent_at is not None


def test_accept_quotation(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    services.send_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    services.accept_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    assert q.status == QuotationStatus.ACCEPTED


def test_reject_requires_reason(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    services.send_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    with pytest.raises(ValidationError):
        services.reject_quotation(quotation=q, user=owner, reason="")


def test_cancel_requires_reason(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    with pytest.raises(ValidationError):
        services.cancel_quotation(quotation=q, user=owner, reason="")


def test_expire_overdue(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(
        company, customer, owner, [_line(product)],
        valid_until=date.today() - timedelta(days=1),
    )
    services.send_quotation(quotation=q, user=owner)
    count = services.expire_quotations(company=company, user=owner)
    assert count >= 1
    q.refresh_from_db()
    assert q.status == QuotationStatus.EXPIRED


def test_converted_cannot_be_edited(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    services.send_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    services.convert_quotation_to_sales_draft(quotation=q, user=owner)
    q.refresh_from_db()
    with pytest.raises(ValidationError):
        services.send_quotation(quotation=q, user=owner)


# ── Conversion ──────────────────────────────────────────────────────────────
def test_convert_to_sales_draft(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("100"))
    q = _create(company, customer, owner, [_line(product)])
    services.send_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    q, invoice = services.convert_quotation_to_sales_draft(quotation=q, user=owner)

    assert q.status == QuotationStatus.CONVERTED
    assert invoice.status == SalesStatus.DRAFT
    assert invoice.lines.count() == 1
    assert invoice.lines.first().unit_price == Decimal("100.00")
    assert q.converted_sales_invoice_id == invoice.id
    assert not InventoryBalance.objects.filter(company=company).exists()
    assert not CustomerLedgerEntry.objects.filter(customer=customer).exists()


def test_convert_twice_blocked(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    services.send_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    services.convert_quotation_to_sales_draft(quotation=q, user=owner)
    q.refresh_from_db()
    with pytest.raises(ValidationError):
        services.convert_quotation_to_sales_draft(quotation=q, user=owner)


def test_rejected_cannot_convert(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    services.reject_quotation(quotation=q, user=owner, reason="no deal")
    q.refresh_from_db()
    with pytest.raises(ValidationError):
        services.convert_quotation_to_sales_draft(quotation=q, user=owner)


# ── Print preview ───────────────────────────────────────────────────────────
def test_print_preview_not_tax_invoice(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    preview = services.build_quotation_print_preview(q)
    assert preview["title_en"] == "QUOTATION"
    assert preview["not_tax_invoice_en"] == "This quotation is not a tax invoice."
    assert "lines" in preview
    assert "totals" in preview


# ── Stock warning ───────────────────────────────────────────────────────────
def test_stock_warning_informational_only(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product, quantity_kg="100")])
    warnings = services.quotation_stock_warning(q)
    assert len(warnings) == 1
    assert warnings[0]["enough_stock"] is False
    assert not StockMovement.objects.filter(company=company).exists()


# ── API / permissions ───────────────────────────────────────────────────────
def test_owner_can_create_and_send(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    api.force_authenticate(owner)
    resp = api.post(QUOTATIONS_URL, {
        "customer": customer.id,
        "quotation_date": str(date.today()),
        "valid_until": str(date.today() + timedelta(days=30)),
        "vat_rate": "0",
        "lines": [{
            "product": product.id, "line_type": "product",
            "quantity_kg": "10", "price_type": "kg",
        }],
    }, format="json")
    assert resp.status_code == 201, resp.data
    qid = resp.data["id"]
    resp = api.post(f"{QUOTATIONS_URL}{qid}/send/", {}, format="json")
    assert resp.status_code == 200
    assert resp.data["status"] == QuotationStatus.SENT


def test_cashier_cannot_convert(api, company, owner, cashier):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    services.send_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    api.force_authenticate(cashier)
    resp = api.post(f"{QUOTATIONS_URL}{q.id}/convert-to-sales/", {}, format="json")
    assert resp.status_code == 403


def test_cashier_cannot_cancel(api, company, owner, cashier):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    api.force_authenticate(cashier)
    resp = api.post(f"{QUOTATIONS_URL}{q.id}/cancel/", {"reason": "x"}, format="json")
    assert resp.status_code == 403


def test_tenant_isolation(api, company, owner, other_owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    api.force_authenticate(other_owner)
    resp = api.get(f"{QUOTATIONS_URL}{q.id}/")
    assert resp.status_code == 404


def test_conversion_creates_audit(company, owner):
    customer = _customer(company)
    product = _product(company)
    q = _create(company, customer, owner, [_line(product)])
    services.send_quotation(quotation=q, user=owner)
    q.refresh_from_db()
    services.convert_quotation_to_sales_draft(quotation=q, user=owner)
    assert AuditLog.objects.filter(
        company=company, action="convert_quotation_to_sales", reference_id=str(q.id)
    ).exists()
