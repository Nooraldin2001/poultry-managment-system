"""Phase 5 sales tests: draft, approval, FIFO, ledger, credit, cancellation, APIs."""

from datetime import date
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
from apps.inventory import services as inventory_services
from apps.inventory.models import (
    InventoryBalance,
    MovementType,
    StockMovement,
    StockSourceType,
)
from apps.products.models import Product, ProductCategory, ProductType
from apps.sales import services
from apps.sales.models import (
    SalesInventoryAllocation,
    SalesInvoice,
    SalesInvoiceAdjustment,
    SalesLineType,
    SalesPriceSource,
    SalesStatus,
)

pytestmark = pytest.mark.django_db

SALES_URL = "/api/v1/tenant/sales/"


def _customer(company, phone="0500000001", **kwargs):
    defaults = dict(
        company=company, name_ar="عميل", phone=phone,
        customer_type=CustomerType.CREDIT,
        credit_limit=Decimal("50000.00"),
        block_sales_when_credit_exceeded=True,
    )
    defaults.update(kwargs)
    return Customer.objects.create(**defaults)


def _product(company, sku="SAL1", **kwargs):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    defaults = dict(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, sales_price=Decimal("100.00"),
        purchase_price=Decimal("10.00"), can_sell=True,
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _line(product, **kwargs):
    data = dict(
        product=product, line_type=SalesLineType.PRODUCT,
        quantity_cartons=Decimal("0"), quantity_pieces=Decimal("0"),
        quantity_kg=Decimal("0"), price_type="kg",
    )
    data.update(kwargs)
    return data


def _create(company, customer, owner, lines, **kwargs):
    kwargs.setdefault("vat_rate", Decimal("0"))
    return services.create_sales_invoice(
        company=company, customer=customer, created_by=owner,
        invoice_date=date.today(), lines=lines, **kwargs,
    )


def _seed_stock(company, owner, product, kg="100", cost="10"):
    inventory_services.add_stock(
        company=company, product=product,
        kg=Decimal(kg), unit_cost_per_kg=Decimal(cost),
        source_type=StockSourceType.OPENING_INVENTORY,
        reason="opening stock", user=owner,
        movement_type=MovementType.OPENING_INVENTORY,
    )


def _payload(customer, product, **overrides):
    data = {
        "customer": customer.id,
        "invoice_date": str(date.today()),
        "vat_rate": "0",
        "lines": [{
            "product": product.id, "line_type": "product",
            "quantity_kg": "10", "price_type": "kg",
        }],
    }
    data.update(overrides)
    return data


# ── Creation ────────────────────────────────────────────────────────────────
def test_create_draft_has_no_side_effects(company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])

    assert inv.status == SalesStatus.DRAFT
    assert inv.invoice_number.startswith("SAL-")
    assert str(date.today().year) in inv.invoice_number
    assert not CustomerLedgerEntry.objects.filter(customer=customer).exists()
    customer.refresh_from_db()
    assert customer.current_balance == Decimal("0.00")
    balance = InventoryBalance.objects.filter(company=company, product=product).first()
    assert balance is None or balance.available_kg == Decimal("0.000")


def test_line_subtotal_by_kg(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("12"))
    inv = _create(company, customer, owner,
                  [_line(product, quantity_kg="100", price_type="kg")])
    assert inv.lines.first().line_subtotal == Decimal("1200.00")


def test_line_subtotal_by_piece(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("3"))
    inv = _create(company, customer, owner,
                  [_line(product, quantity_pieces="50", price_type="piece")])
    assert inv.lines.first().line_subtotal == Decimal("150.00")


def test_line_subtotal_by_carton(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("40"))
    inv = _create(company, customer, owner,
                  [_line(product, quantity_cartons="20", price_type="carton")])
    assert inv.lines.first().line_subtotal == Decimal("800.00")


def test_negative_quantity_rejected(company, owner):
    customer = _customer(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, customer, owner, [_line(product, quantity_kg="-1")])


def test_negative_price_rejected(company, owner):
    customer = _customer(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, customer, owner, [
            _line(product, quantity_kg="10", unit_price="-5",
                  price_source=SalesPriceSource.MANUAL_OVERRIDE),
        ])


def test_customer_cross_tenant_rejected(company, owner, other_company):
    other_customer = _customer(other_company, phone="0500000099")
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, other_customer, owner, [_line(product, quantity_kg="10")])


def test_product_cross_tenant_rejected(company, owner, other_company):
    customer = _customer(company)
    other_product = _product(other_company, sku="OT")
    with pytest.raises(ValidationError):
        _create(company, customer, owner, [_line(other_product, quantity_kg="10")])


def test_customer_special_price_applied(company, owner):
    customer = _customer(company)
    product = _product(company, sales_price=Decimal("100"))
    CustomerSpecialPrice.objects.create(
        company=company, customer=customer, product=product,
        price=Decimal("85.00"), price_type="kg", is_active=True,
    )
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    line = inv.lines.first()
    assert line.unit_price == Decimal("85.00")
    assert line.price_source == SalesPriceSource.CUSTOMER_SPECIAL_PRICE


def test_free_product_agreement_applied(company, owner):
    customer = _customer(company)
    product = _product(company)
    CustomerFreeProductAgreement.objects.create(
        company=company, customer=customer, product=product,
        agreement_type=CustomerFreeProductAgreement.AgreementType.ALWAYS_FREE,
        is_active=True,
    )
    inv = _create(company, customer, owner, [
        _line(product, quantity_kg="5", is_free=True),
    ])
    line = inv.lines.first()
    assert line.is_free is True
    assert line.unit_price == Decimal("0.00")
    assert line.price_source == SalesPriceSource.FREE_PRODUCT


def test_manual_price_override_requires_permission(company, cashier):
    customer = _customer(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, customer, cashier, [
            _line(product, quantity_kg="10", unit_price="50",
                  price_source=SalesPriceSource.MANUAL_OVERRIDE),
        ])


# ── Approval ────────────────────────────────────────────────────────────────
def test_approval_requires_reason(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    with pytest.raises(ValidationError):
        services.approve_sales_invoice(invoice=inv, user=owner, reason="")


def test_approval_consumes_inventory_fifo(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product, kg="100", cost="8")
    inv = _create(company, customer, owner, [_line(product, quantity_kg="30")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="sold")

    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("70.000")
    assert StockMovement.objects.filter(
        company=company, movement_type=MovementType.SALES_APPROVED
    ).exists()
    assert SalesInventoryAllocation.objects.filter(invoice=inv).exists()


def test_approval_records_fifo_cost_and_gross_profit(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product, kg="100", cost="10")
    inv = _create(company, customer, owner,
                  [_line(product, quantity_kg="10", unit_price="100")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="sold")
    inv.refresh_from_db()
    assert inv.fifo_cost_total == Decimal("100.00")  # 10 kg × 10 cost
    assert inv.gross_profit == Decimal("900.00")  # 1000 revenue - 100 cost


def test_approval_creates_customer_ledger_and_balance(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner,
                  [_line(product, quantity_kg="10", unit_price="100")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="sold")

    customer.refresh_from_db()
    assert customer.current_balance == Decimal("1000.00")
    entry = CustomerLedgerEntry.objects.get(
        customer=customer, entry_type=CustomerLedgerEntry.EntryType.SALES_INVOICE
    )
    assert entry.debit == Decimal("1000.00")
    assert entry.reference_id == str(inv.id)


def test_approval_creates_audit_log(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="audit")
    assert AuditLog.objects.filter(
        company=company, action="approve_sales_invoice", reference_id=str(inv.id)
    ).exists()


def test_approval_cannot_run_twice(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    with pytest.raises(ValidationError):
        services.approve_sales_invoice(invoice=inv, user=owner, reason="again")


def test_invoice_without_lines_cannot_be_approved(company, owner):
    customer = _customer(company)
    inv = _create(company, customer, owner, [])
    with pytest.raises(ValidationError):
        services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")


def test_insufficient_stock_blocks_approval(company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    with pytest.raises(ValidationError):
        services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")


# ── Credit limit ────────────────────────────────────────────────────────────
def test_credit_limit_exceeded_blocks_approval(company, owner):
    customer = _customer(
        company, credit_limit=Decimal("500.00"), current_balance=Decimal("400.00")
    )
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner,
                  [_line(product, quantity_kg="2", unit_price="100")])  # total 200 → 600
    with pytest.raises(ValidationError):
        services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")


def test_credit_override_allows_approval(company, owner):
    customer = _customer(
        company, credit_limit=Decimal("500.00"), current_balance=Decimal("400.00")
    )
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner,
                  [_line(product, quantity_kg="2", unit_price="100")])
    services.approve_sales_invoice(
        invoice=inv, user=owner, reason="manager approved",
        credit_override={"allowed": True, "reason": "trusted customer"},
    )
    inv.refresh_from_db()
    assert inv.status == SalesStatus.APPROVED
    assert inv.credit_limit_override_used is True
    assert AuditLog.objects.filter(
        company=company, action="approve_sales_invoice", reference_id=str(inv.id)
    ).exists()


# ── Cancellation ────────────────────────────────────────────────────────────
def test_cancellation_requires_reason(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    with pytest.raises(ValidationError):
        services.cancel_sales_invoice(invoice=inv, user=owner, reason="")


def test_cancellation_returns_stock_and_reverses_ledger(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product, kg="100")
    inv = _create(company, customer, owner,
                  [_line(product, quantity_kg="10", unit_price="100")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    services.cancel_sales_invoice(invoice=inv, user=owner, reason="mistake")

    inv.refresh_from_db()
    assert inv.status == SalesStatus.CANCELLED
    customer.refresh_from_db()
    assert customer.current_balance == Decimal("0.00")
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("100.000")
    assert StockMovement.objects.filter(
        company=company, movement_type=MovementType.SALES_CANCELLED
    ).exists()
    assert CustomerLedgerEntry.objects.filter(
        customer=customer, entry_type=CustomerLedgerEntry.EntryType.SALES_RETURN
    ).exists()


def test_cancellation_cannot_run_twice(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    services.cancel_sales_invoice(invoice=inv, user=owner, reason="cancel")
    inv.refresh_from_db()
    with pytest.raises(ValidationError):
        services.cancel_sales_invoice(invoice=inv, user=owner, reason="again")


# ── Collection adjustment ───────────────────────────────────────────────────
def test_collection_adjustment_reduces_balance_without_line_edit(company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner,
                  [_line(product, quantity_kg="10", unit_price="100")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    line_count = inv.lines.count()
    services.create_collection_adjustment(
        invoice=inv, user=owner, amount=Decimal("100"), reason="goodwill discount"
    )
    inv.refresh_from_db()
    assert inv.lines.count() == line_count
    customer.refresh_from_db()
    assert customer.current_balance == Decimal("900.00")
    assert SalesInvoiceAdjustment.objects.filter(invoice=inv).exists()
    assert AuditLog.objects.filter(
        company=company, action="collection_adjustment", reference_id=str(inv.id)
    ).exists()


# ── Print preview ───────────────────────────────────────────────────────────
def test_print_preview_structure(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="5")])
    api.force_authenticate(owner)
    resp = api.get(f"{SALES_URL}{inv.id}/print-preview/")
    assert resp.status_code == 200
    assert resp.data["title_en"] == "TAX INVOICE"
    assert resp.data["title_ar"] == "فاتورة ضريبية"
    assert "company" in resp.data
    assert "customer" in resp.data
    assert "lines" in resp.data
    assert "totals" in resp.data


# ── API / permissions ───────────────────────────────────────────────────────
def test_create_rejects_manual_invoice_number(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    api.force_authenticate(owner)
    resp = api.post(
        SALES_URL,
        _payload(customer, product, invoice_number="MANUAL-001"),
        format="json",
    )
    assert resp.status_code == 400
    assert "invoice_number" in resp.data


def test_cash_customer_approve_requires_full_amount_paid(api, company, owner):
    customer = _customer(company, customer_type=CustomerType.CASH)
    product = _product(company)
    _seed_stock(company, owner, product, kg="100")
    api.force_authenticate(owner)
    resp = api.post(SALES_URL, _payload(customer, product), format="json")
    assert resp.status_code == 201, resp.data
    inv_id = resp.data["id"]
    resp = api.post(f"{SALES_URL}{inv_id}/approve/", {"reason": "ok"}, format="json")
    assert resp.status_code == 400
    assert "amount_paid" in resp.data

    resp = api.patch(
        f"{SALES_URL}{inv_id}/",
        {"amount_paid": api.get(f"{SALES_URL}{inv_id}/").data["total_amount"]},
        format="json",
    )
    assert resp.status_code == 200
    resp = api.post(f"{SALES_URL}{inv_id}/approve/", {"reason": "ok"}, format="json")
    assert resp.status_code == 200


def test_owner_can_create_approve_cancel(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    api.force_authenticate(owner)

    resp = api.post(SALES_URL, _payload(customer, product), format="json")
    assert resp.status_code == 201, resp.data
    inv_id = resp.data["id"]

    resp = api.post(f"{SALES_URL}{inv_id}/approve/", {"reason": "ok"}, format="json")
    assert resp.status_code == 200
    assert resp.data["status"] == SalesStatus.APPROVED

    resp = api.post(f"{SALES_URL}{inv_id}/cancel/", {"reason": "no"}, format="json")
    assert resp.status_code == 200
    assert resp.data["status"] == SalesStatus.CANCELLED


def test_accountant_can_approve_but_not_cancel(api, company, owner, accountant):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    api.force_authenticate(accountant)

    resp = api.post(f"{SALES_URL}{inv.id}/approve/", {"reason": "ok"}, format="json")
    assert resp.status_code == 200

    resp = api.post(f"{SALES_URL}{inv.id}/cancel/", {"reason": "no"}, format="json")
    assert resp.status_code == 403


def test_cashier_can_create_but_not_approve(api, company, owner, cashier):
    customer = _customer(company)
    product = _product(company)
    api.force_authenticate(cashier)
    resp = api.post(SALES_URL, _payload(customer, product), format="json")
    assert resp.status_code == 201
    inv_id = resp.data["id"]
    resp = api.post(f"{SALES_URL}{inv_id}/approve/", {"reason": "ok"}, format="json")
    assert resp.status_code == 403


def test_cashier_cannot_view_profit(api, company, owner, cashier):
    customer = _customer(company)
    product = _product(company)
    _seed_stock(company, owner, product)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="ok")
    api.force_authenticate(cashier)
    resp = api.get(f"{SALES_URL}{inv.id}/")
    assert resp.status_code == 200
    assert "gross_profit" not in resp.data
    assert "fifo_cost_total" not in resp.data


def test_tenant_isolation(api, company, owner, other_owner):
    customer = _customer(company)
    product = _product(company)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="5")])
    api.force_authenticate(other_owner)
    resp = api.get(f"{SALES_URL}{inv.id}/")
    assert resp.status_code == 404


def test_stock_check_respects_tenant(api, company, owner, other_owner):
    product = _product(company)
    _seed_stock(company, owner, product)
    api.force_authenticate(other_owner)
    resp = api.get(
        f"{SALES_URL}stock-check/?product={product.id}&kg=1"
    )
    assert resp.status_code == 404


def test_price_preview_respects_tenant(api, company, owner, other_owner):
    customer = _customer(company)
    product = _product(company)
    api.force_authenticate(other_owner)
    resp = api.get(
        f"{SALES_URL}price-preview/?customer={customer.id}&product={product.id}&price_type=kg"
    )
    assert resp.status_code == 404


# ── Cancelled invoices hidden from default list ─────────────────────────────
def test_sales_list_hides_cancelled_by_default(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    active = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    cancelled = _create(company, customer, owner, [_line(product, quantity_kg="5")])
    services.cancel_sales_invoice(invoice=cancelled, user=owner, reason="mistake")

    api.force_authenticate(owner)
    resp = api.get(SALES_URL)
    assert resp.status_code == 200
    ids = [row["id"] for row in resp.data["results"]]
    assert active.id in ids
    assert cancelled.id not in ids

    resp = api.get(f"{SALES_URL}?status=cancelled")
    ids = [row["id"] for row in resp.data["results"]]
    assert ids == [cancelled.id]

    resp = api.get(f"{SALES_URL}?include_cancelled=1")
    ids = [row["id"] for row in resp.data["results"]]
    assert active.id in ids and cancelled.id in ids


# ── Price override on line PATCH ─────────────────────────────────────────────
def test_line_price_patch_requires_override_permission(api, company, owner, accountant):
    customer = _customer(company)
    product = _product(company)
    inv = _create(company, customer, owner, [_line(product, quantity_kg="10")])
    line = inv.lines.first()
    url = f"{SALES_URL}{inv.id}/lines/{line.id}/"

    # Accountant has sales.edit but NOT sales.override_price.
    api.force_authenticate(accountant)
    resp = api.patch(url, {"unit_price": "55.00"}, format="json")
    assert resp.status_code == 403, resp.data

    # Quantity-only edits (price unchanged) stay allowed.
    resp = api.patch(url, {"quantity_kg": "12", "unit_price": str(line.unit_price)}, format="json")
    assert resp.status_code == 200, resp.data

    # Owner can override; the line stores the price and is audit-logged.
    api.force_authenticate(owner)
    resp = api.patch(url, {"unit_price": "55.00", "override_reason": "old agreed price"}, format="json")
    assert resp.status_code == 200, resp.data
    line.refresh_from_db()
    assert line.unit_price == Decimal("55.00")
    assert line.price_source == SalesPriceSource.MANUAL_OVERRIDE
    assert AuditLog.objects.filter(
        company=company, action="override_sales_price", reference_id=inv.id
    ).exists()


def test_manual_override_price_must_be_positive(company, owner):
    customer = _customer(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, customer, owner, [_line(
            product, quantity_kg="10", unit_price="0",
            price_source=SalesPriceSource.MANUAL_OVERRIDE,
        )])


# ── Price history ────────────────────────────────────────────────────────────
def test_sales_price_history_returns_real_prices(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    _create(company, customer, owner, [_line(
        product, quantity_kg="10", unit_price="88.00",
        price_source=SalesPriceSource.MANUAL_OVERRIDE,
    )])
    CustomerSpecialPrice.objects.create(
        company=company, customer=customer, product=product,
        price=Decimal("77.00"), price_type="kg", is_active=True,
    )

    api.force_authenticate(owner)
    resp = api.get(f"{SALES_URL}price-history/?customer={customer.id}&product={product.id}")
    assert resp.status_code == 200, resp.data
    sources = {row["source"] for row in resp.data}
    assert "previous_invoice" in sources
    assert "customer_special_price" in sources
    assert "default_product_price" in sources
    prices = {row["price"] for row in resp.data}
    assert "88.00" in prices and "77.00" in prices and "100.00" in prices
    inv_entry = next(r for r in resp.data if r["source"] == "previous_invoice")
    assert inv_entry["invoice_number"].startswith("SAL-")
    assert inv_entry["date"]


def test_sales_price_history_excludes_cancelled_invoices(api, company, owner):
    customer = _customer(company)
    product = _product(company)
    inv = _create(company, customer, owner, [_line(
        product, quantity_kg="10", unit_price="66.00",
        price_source=SalesPriceSource.MANUAL_OVERRIDE,
    )])
    services.cancel_sales_invoice(invoice=inv, user=owner, reason="mistake")

    api.force_authenticate(owner)
    resp = api.get(f"{SALES_URL}price-history/?customer={customer.id}&product={product.id}")
    assert resp.status_code == 200
    assert "66.00" not in {row["price"] for row in resp.data}


def test_sales_price_history_respects_tenant(api, company, owner, other_owner):
    customer = _customer(company)
    product = _product(company)
    api.force_authenticate(other_owner)
    resp = api.get(f"{SALES_URL}price-history/?customer={customer.id}&product={product.id}")
    assert resp.status_code == 404


def test_sales_chicken_part_deducts_kg_and_blocks_oversell(company, owner):
    customer = _customer(company)
    cat = ProductCategory.objects.create(company=company, name_ar="مقطعات", code="PARTS-S")
    liver = Product.objects.create(
        company=company, category=cat, name_ar="كبده", sku="S-LIVER",
        product_type=ProductType.CHICKEN_PART,
        sales_price=Decimal("5.00"), sales_price_type="kg",
        track_inventory=True, can_sell=True,
    )
    _seed_stock(company, owner, liver, kg="30", cost="4")
    inv = _create(company, customer, owner, [_line(liver, quantity_kg="10", unit_price="5")])
    services.approve_sales_invoice(invoice=inv, user=owner, reason="sold")
    balance = InventoryBalance.objects.get(company=company, product=liver)
    assert balance.available_kg == Decimal("20.000")
    with pytest.raises(ValidationError):
        oversell = _create(
            company, customer, owner, [_line(liver, quantity_kg="25", unit_price="5")],
        )
        services.approve_sales_invoice(invoice=oversell, user=owner, reason="too much")

