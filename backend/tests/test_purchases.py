"""Phase 4 purchase tests: creation, approval, adjustments, cancellation, APIs.

Also includes production data-hygiene checks (deploy scripts / env / frontend).
"""

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.inventory import services as inventory_services
from apps.inventory.models import (
    FIFOStockLayer,
    InventoryBalance,
    MovementType,
    StockMovement,
    StockSourceType,
)
from apps.products.models import Product, ProductCategory, ProductType
from apps.purchases import services
from apps.purchases.models import (
    PurchaseAdjustmentEffect,
    PurchaseAdjustmentType,
    PurchaseInvoice,
    PurchaseLineType,
    PurchaseStatus,
)
from apps.payments.models import MoneyAccount, MoneyMovement, MoneyMovementType
from apps.suppliers.models import Supplier, SupplierCategory, SupplierLedgerEntry, SupplierType

pytestmark = pytest.mark.django_db

REPO_ROOT = Path(__file__).resolve().parents[2]
def _supplier(company, sku="S1", **kwargs):
    defaults = dict(
        company=company, name_ar="مورد", phone="0500000000",
        supplier_type=SupplierType.CREDIT, trn="",
    )
    defaults.update(kwargs)
    return Supplier.objects.create(**defaults)


def _product(company, sku="PUR1", **kwargs):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    defaults = dict(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10, purchase_price=Decimal("10.00"),
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _cut_product(company, sku="CUT-LIVER", name_ar="كبده", **kwargs):
    cat = ProductCategory.objects.create(
        company=company, name_ar="مقطعات", code=f"PARTS{sku}",
    )
    defaults = dict(
        company=company, category=cat, name_ar=name_ar, sku=sku,
        product_type=ProductType.CHICKEN_PART,
        purchase_price=Decimal("4.00"), purchase_price_type="kg",
        track_inventory=True, can_purchase=True, can_sell=True,
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _line(product, **kwargs):
    data = dict(
        product=product, line_type=PurchaseLineType.PRODUCT,
        quantity_cartons=Decimal("0"), quantity_pieces=Decimal("0"),
        quantity_kg=Decimal("0"), unit_price=Decimal("10"), price_type="kg",
    )
    data.update(kwargs)
    return data


def _create(company, supplier, owner, lines, **kwargs):
    return services.create_purchase_invoice(
        company=company, supplier=supplier, created_by=owner,
        invoice_date=date.today(), lines=lines, **kwargs,
    )


# ── Creation ────────────────────────────────────────────────────────────────
def test_create_draft_has_no_side_effects(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])

    assert inv.status == PurchaseStatus.DRAFT
    assert inv.invoice_number.startswith("PUR-")
    assert str(date.today().year) in inv.invoice_number
    assert not InventoryBalance.objects.filter(company=company).exists()
    assert not FIFOStockLayer.objects.filter(company=company).exists()
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("0.00")
    assert not SupplierLedgerEntry.objects.filter(supplier=supplier).exists()


def test_line_subtotal_by_kg(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner,
                  [_line(product, quantity_kg="100", unit_price="12", price_type="kg")])
    assert inv.lines.first().line_subtotal == Decimal("1200.00")
    assert inv.subtotal == Decimal("1200.00")


def test_line_subtotal_by_piece(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner,
                  [_line(product, quantity_pieces="50", unit_price="3", price_type="piece")])
    assert inv.lines.first().line_subtotal == Decimal("150.00")


def test_line_subtotal_by_carton(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner,
                  [_line(product, quantity_cartons="20", unit_price="40", price_type="carton")])
    assert inv.lines.first().line_subtotal == Decimal("800.00")


def test_supplier_cross_tenant_rejected(company, owner, other_company):
    other_supplier = _supplier(other_company, sku="OS")
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(company, other_supplier, owner, [_line(product, quantity_kg="10")])


def test_product_cross_tenant_rejected(company, owner, other_company):
    supplier = _supplier(company)
    other_product = _product(other_company, sku="OP")
    with pytest.raises(ValidationError):
        _create(company, supplier, owner, [_line(other_product, quantity_kg="10")])


def test_duplicate_supplier_invoice_number_rejected(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    _create(company, supplier, owner, [_line(product, quantity_kg="10")],
            supplier_invoice_number="SUP-1")
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            _create(company, supplier, owner, [_line(product, quantity_kg="10")],
                    supplier_invoice_number="SUP-1")


# ── Approval ────────────────────────────────────────────────────────────────
def test_approval_requires_reason(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    with pytest.raises(ValidationError):
        services.approve_purchase_invoice(invoice=inv, user=owner, reason="")


def test_approval_creates_inventory_layer_and_movement(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner,
                  [_line(product, quantity_cartons="10", quantity_kg="100", unit_price="10")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="received")

    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("100.000")
    layer = FIFOStockLayer.objects.get(
        company=company, source_type=StockSourceType.PURCHASE_INVOICE, source_id=inv.id
    )
    assert layer.unit_cost_per_kg == Decimal("10.0000")
    assert StockMovement.objects.filter(
        company=company, movement_type=MovementType.PURCHASE_APPROVED
    ).exists()


def test_approval_posts_supplier_ledger_and_balance(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100", unit_price="10")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")

    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("1000.00")
    entry = SupplierLedgerEntry.objects.get(
        supplier=supplier, entry_type=SupplierLedgerEntry.EntryType.PURCHASE_INVOICE
    )
    assert entry.credit == Decimal("1000.00")
    assert entry.reference_id == str(inv.id)


def test_approval_creates_audit_log(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="audit me")
    assert AuditLog.objects.filter(
        company=company, action="approve_purchase_invoice", reference_id=str(inv.id)
    ).exists()


def test_approval_cannot_run_twice(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    with pytest.raises(ValidationError):
        services.approve_purchase_invoice(invoice=inv, user=owner, reason="again")


def test_invoice_without_lines_cannot_be_approved(company, owner):
    supplier = _supplier(company)
    inv = _create(company, supplier, owner, [])
    with pytest.raises(ValidationError):
        services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")


# ── Adjustments ─────────────────────────────────────────────────────────────
def test_supplier_deduction_reduces_payable(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="100", unit_price="10")],
        adjustments=[{
            "adjustment_type": PurchaseAdjustmentType.COMMERCIAL_DISCOUNT,
            "effect": PurchaseAdjustmentEffect.REDUCE_SUPPLIER_PAYABLE,
            "title": "Discount", "amount": Decimal("100"),
        }],
    )
    assert inv.adjustment_total == Decimal("-100.00")
    assert inv.total_amount == Decimal("900.00")
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("900.00")


def test_inventory_cost_adjustment_increases_unit_cost(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="100", unit_price="10")],
        adjustments=[{
            "adjustment_type": PurchaseAdjustmentType.TRANSPORT_COST,
            "effect": PurchaseAdjustmentEffect.INCREASE_INVENTORY_COST,
            "title": "Transport", "amount": Decimal("200"),
        }],
    )
    # Payable unaffected by inventory-cost adjustment, but cost basis grows.
    assert inv.total_amount == Decimal("1000.00")
    assert inv.inventory_cost_total == Decimal("1200.00")
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    layer = FIFOStockLayer.objects.get(
        company=company, source_type=StockSourceType.PURCHASE_INVOICE, source_id=inv.id
    )
    assert layer.unit_cost_per_kg == Decimal("12.0000")  # (1000+200)/100


def test_adjustment_amount_cannot_be_negative(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(
            company, supplier, owner,
            [_line(product, quantity_kg="100")],
            adjustments=[{
                "adjustment_type": PurchaseAdjustmentType.OTHER,
                "effect": PurchaseAdjustmentEffect.NO_FINANCIAL_EFFECT,
                "title": "Bad", "amount": Decimal("-5"),
            }],
        )


# ── Cancellation ────────────────────────────────────────────────────────────
def test_cancellation_requires_reason(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    with pytest.raises(ValidationError):
        services.cancel_purchase_invoice(invoice=inv, user=owner, reason="")


def test_cancellation_reverses_supplier_ledger_and_inventory(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100", unit_price="10")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    services.cancel_purchase_invoice(invoice=inv, user=owner, reason="mistake")

    inv.refresh_from_db()
    assert inv.status == PurchaseStatus.CANCELLED
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("0.00")
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("0.000")
    assert StockMovement.objects.filter(
        company=company, movement_type=MovementType.PURCHASE_CANCELLED
    ).exists()
    assert SupplierLedgerEntry.objects.filter(
        supplier=supplier,
        entry_type=SupplierLedgerEntry.EntryType.PURCHASE_CANCELLATION,
    ).exists()


def test_cancellation_blocked_if_stock_consumed(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100", unit_price="10")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    # Consume some of the purchased stock.
    inventory_services.consume_stock_fifo(
        company=company, product=product, kg=Decimal("10"), reason="sold",
    )
    inv.refresh_from_db()
    with pytest.raises(ValidationError):
        services.cancel_purchase_invoice(invoice=inv, user=owner, reason="too late")


def test_cancellation_creates_audit_and_blocks_twice(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    services.cancel_purchase_invoice(invoice=inv, user=owner, reason="cancel")
    assert AuditLog.objects.filter(
        company=company, action="cancel_purchase_invoice", reference_id=str(inv.id)
    ).exists()
    inv.refresh_from_db()
    with pytest.raises(ValidationError):
        services.cancel_purchase_invoice(invoice=inv, user=owner, reason="again")


# ── API / permissions ───────────────────────────────────────────────────────
PURCHASES_URL = "/api/v1/tenant/purchases/"


def _payload(supplier, product, **overrides):
    data = {
        "supplier": supplier.id,
        "invoice_date": str(date.today()),
        "lines": [{
            "product": product.id, "line_type": "product",
            "quantity_kg": "100", "unit_price": "10", "price_type": "kg",
        }],
    }
    data.update(overrides)
    return data


def test_create_rejects_manual_invoice_number(api, company, owner):
    supplier = _supplier(company)
    product = _product(company)
    api.force_authenticate(owner)
    resp = api.post(
        PURCHASES_URL,
        _payload(supplier, product, invoice_number="MANUAL-001"),
        format="json",
    )
    assert resp.status_code == 400
    assert "invoice_number" in resp.data


def test_owner_can_create_and_approve_and_cancel(api, company, owner):
    supplier = _supplier(company)
    product = _product(company)
    api.force_authenticate(owner)

    resp = api.post(PURCHASES_URL, _payload(supplier, product), format="json")
    assert resp.status_code == 201, resp.data
    inv_id = resp.data["id"]

    resp = api.post(f"{PURCHASES_URL}{inv_id}/approve/", {"reason": "ok"}, format="json")
    assert resp.status_code == 200
    assert resp.data["status"] == PurchaseStatus.APPROVED

    resp = api.post(f"{PURCHASES_URL}{inv_id}/cancel/", {"reason": "no"}, format="json")
    assert resp.status_code == 200
    assert resp.data["status"] == PurchaseStatus.CANCELLED


def test_accountant_can_approve_but_not_cancel(api, company, owner, accountant):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    api.force_authenticate(accountant)

    resp = api.post(f"{PURCHASES_URL}{inv.id}/approve/", {"reason": "ok"}, format="json")
    assert resp.status_code == 200

    resp = api.post(f"{PURCHASES_URL}{inv.id}/cancel/", {"reason": "no"}, format="json")
    assert resp.status_code == 403


def test_negative_quantity_rejected_by_api(api, company, owner):
    supplier = _supplier(company)
    product = _product(company)
    api.force_authenticate(owner)
    payload = _payload(supplier, product)
    payload["lines"][0]["quantity_kg"] = "-5"
    resp = api.post(PURCHASES_URL, payload, format="json")
    assert resp.status_code == 400


def test_stock_tracked_line_requires_quantity(api, company, owner):
    supplier = _supplier(company)
    product = _product(company)
    api.force_authenticate(owner)
    payload = _payload(supplier, product)
    payload["lines"][0]["quantity_kg"] = "0"
    resp = api.post(PURCHASES_URL, payload, format="json")
    assert resp.status_code == 400


def test_print_preview_structure(api, company, owner):
    supplier = _supplier(company, name_ar="WESTLAND FOODSTUFF", name_en="Westland")
    product = _product(company)
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    api.force_authenticate(owner)
    resp = api.get(f"{PURCHASES_URL}{inv.id}/print-preview/")
    assert resp.status_code == 200
    assert resp.data["title_en"] == "PURCHASE INVOICE"
    assert "company" in resp.data
    assert "supplier" in resp.data
    assert "lines" in resp.data
    assert "totals" in resp.data


def test_print_preview_tenant_isolation(api, company, owner, other_company, other_owner):
    supplier = _supplier(other_company, sku="OS")
    product = _product(other_company, sku="OP")
    inv = _create(other_company, supplier, other_owner, [_line(product, quantity_kg="10")])
    api.force_authenticate(owner)
    assert api.get(f"{PURCHASES_URL}{inv.id}/print-preview/").status_code == 404


def test_cashier_cannot_access_purchases(api, company, cashier):
    api.force_authenticate(cashier)
    assert api.get(PURCHASES_URL).status_code == 403
    assert api.get(f"{PURCHASES_URL}summary/").status_code == 403


def test_tenant_cannot_access_other_company_purchase(api, company, owner,
                                                     other_company, other_owner):
    supplier = _supplier(other_company, sku="OS")
    product = _product(other_company, sku="OP")
    inv = _create(other_company, supplier, other_owner, [_line(product, quantity_kg="10")])
    api.force_authenticate(owner)
    assert api.get(f"{PURCHASES_URL}{inv.id}/").status_code == 404


def test_summary_requires_permission(api, company, owner):
    api.force_authenticate(owner)
    resp = api.get(f"{PURCHASES_URL}summary/")
    assert resp.status_code == 200
    assert "supplier_payable_total" in resp.data


# ── Cancelled invoices hidden from default list ─────────────────────────────
def test_purchase_list_hides_cancelled_by_default(api, company, owner):
    supplier = _supplier(company)
    product = _product(company)
    active = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    cancelled = _create(company, supplier, owner, [_line(product, quantity_kg="50")])
    services.cancel_purchase_invoice(invoice=cancelled, user=owner, reason="mistake")

    api.force_authenticate(owner)
    resp = api.get(PURCHASES_URL)
    assert resp.status_code == 200
    ids = [row["id"] for row in resp.data["results"]]
    assert active.id in ids
    assert cancelled.id not in ids

    resp = api.get(f"{PURCHASES_URL}?status=cancelled")
    ids = [row["id"] for row in resp.data["results"]]
    assert ids == [cancelled.id]


# ── Purchase price override ──────────────────────────────────────────────────
def test_purchase_line_price_override_requires_permission(api, company, owner, accountant):
    supplier = _supplier(company)
    product = _product(company, purchase_price=Decimal("10.00"))
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    line = inv.lines.first()
    url = f"{PURCHASES_URL}{inv.id}/lines/{line.id}/"

    api.force_authenticate(accountant)
    resp = api.patch(url, {"unit_price": "15.00"}, format="json")
    assert resp.status_code == 403, resp.data

    api.force_authenticate(owner)
    resp = api.patch(
        url, {"unit_price": "15.00", "override_reason": "supplier old price"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    line.refresh_from_db()
    assert line.unit_price == Decimal("15.00")
    assert AuditLog.objects.filter(
        company=company, action="override_purchase_price", reference_id=inv.id
    ).exists()


def test_purchase_price_history_returns_real_prices(api, company, owner):
    from apps.suppliers.models import SupplierSpecialPrice

    supplier = _supplier(company)
    product = _product(company, purchase_price=Decimal("10.00"))
    _create(company, supplier, owner, [_line(
        product, quantity_kg="100", unit_price=Decimal("14.50"),
    )])
    SupplierSpecialPrice.objects.create(
        company=company, supplier=supplier, product=product,
        price=Decimal("12.00"), price_type="kg", is_active=True,
    )

    api.force_authenticate(owner)
    resp = api.get(
        f"{PURCHASES_URL}price-history/?supplier={supplier.id}&product={product.id}"
    )
    assert resp.status_code == 200, resp.data
    sources = {row["source"] for row in resp.data}
    assert "previous_invoice" in sources
    assert "supplier_special_price" in sources
    assert "default_purchase_price" in sources
    prices = {row["price"] for row in resp.data}
    assert "14.50" in prices and "12.00" in prices and "10.00" in prices


def test_purchase_price_history_respects_tenant(api, company, owner, other_owner):
    supplier = _supplier(company)
    product = _product(company)
    api.force_authenticate(other_owner)
    resp = api.get(
        f"{PURCHASES_URL}price-history/?supplier={supplier.id}&product={product.id}"
    )
    assert resp.status_code == 404


# ── No-VAT purchases ────────────────────────────────────────────────────────
def test_create_without_vat(company, owner):
    supplier = _supplier(company, trn="")
    product = _product(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="100", unit_price="10", vat_rate=Decimal("0"))],
        vat_rate=Decimal("0"),
    )
    assert inv.vat_amount == Decimal("0.00")
    assert inv.total_amount == Decimal("1000.00")
    assert inv.subtotal == Decimal("1000.00")


def test_approve_no_vat_increases_inventory(company, owner):
    supplier = _supplier(company, trn="")
    product = _product(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="100", unit_price="10", vat_rate=Decimal("0"))],
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="received")

    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("100.000")
    assert FIFOStockLayer.objects.filter(
        company=company, source_type=StockSourceType.PURCHASE_INVOICE, source_id=inv.id
    ).exists()
    assert StockMovement.objects.filter(
        company=company, movement_type=MovementType.PURCHASE_APPROVED
    ).exists()


def test_approve_no_vat_updates_supplier_balance(company, owner):
    supplier = _supplier(company, trn="")
    product = _product(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="100", unit_price="10", vat_rate=Decimal("0"))],
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("1000.00")


def test_approve_cartons_only_fixed_weight_derives_kg(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_cartons="10", quantity_kg="0", unit_price="10")],
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="received")
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("100.000")


def test_api_create_and_approve_without_vat(api, company, owner):
    supplier = _supplier(company, trn="")
    product = _product(company)
    api.force_authenticate(owner)
    resp = api.post(
        PURCHASES_URL,
        {
            "supplier": supplier.id,
            "invoice_date": str(date.today()),
            "vat_rate": "0.00",
            "lines": [{
                "product": product.id,
                "line_type": "product",
                "quantity_kg": "50",
                "unit_price": "10",
                "price_type": "kg",
                "vat_rate": "0.00",
            }],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["vat_amount"] == "0.00"
    inv_id = resp.data["id"]

    resp = api.post(f"{PURCHASES_URL}{inv_id}/approve/", {"reason": "received"}, format="json")
    assert resp.status_code == 200, resp.data
    assert resp.data["vat_amount"] == "0.00"
    assert resp.data["status"] == PurchaseStatus.APPROVED


def test_cross_tenant_purchase_approval_inventory_isolated(company, owner, other_company):
    supplier = _supplier(company)
    product = _product(company)
    other_product = _product(other_company, sku="OTHER")
    inv = _create(company, supplier, owner, [_line(product, quantity_kg="100")])
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    assert InventoryBalance.objects.filter(company=company, product=product).exists()
    assert not InventoryBalance.objects.filter(company=other_company, product=other_product).exists()


def test_fixed_weight_50_cartons_equals_250_kg_on_approve(company, owner):
    supplier = _supplier(company)
    product = _product(
        company, sku="500G", weight_grams=500, default_pieces_per_carton=10,
    )
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_cartons="50", quantity_kg="0", unit_price="10")],
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="received")
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("250.000")
    assert balance.available_cartons == Decimal("50.00")
    assert balance.available_pieces == Decimal("500.00")


def test_repair_dry_run_does_not_add_stock(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="100", unit_price="10")],
        vat_rate=Decimal("0"),
    )
    inv.status = PurchaseStatus.APPROVED
    inv.save(update_fields=["status", "updated_at"])
    assert services.purchase_needs_inventory_repair(inv)
    report = services.repair_purchase_inventory_side_effects(
        company=company, user=owner, dry_run=True, invoices=[inv],
    )
    assert report["dry_run"] is True
    assert report["repaired_count"] == 0
    assert not InventoryBalance.objects.filter(company=company, product=product).exists()


def test_repair_confirm_adds_missing_stock(company, owner):
    supplier = _supplier(company)
    product = _product(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="100", unit_price="10")],
        vat_rate=Decimal("0"),
    )
    inv.status = PurchaseStatus.APPROVED
    inv.approved_by = owner
    inv.save(update_fields=["status", "approved_by", "updated_at"])
    report = services.repair_purchase_inventory_side_effects(
        company=company, user=owner, dry_run=False, invoices=[inv],
    )
    assert report["repaired_count"] == 1
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("100.000")
    assert StockMovement.objects.filter(
        company=company, movement_type=MovementType.PURCHASE_APPROVED
    ).exists()
    # Idempotent second run
    report2 = services.repair_purchase_inventory_side_effects(
        company=company, user=owner, dry_run=False, invoices=[inv],
    )
    assert report2["repaired_count"] == 0
    balance.refresh_from_db()
    assert balance.available_kg == Decimal("100.000")


# ── Poultry cuts (KG-primary) ───────────────────────────────────────────────
def test_purchase_chicken_part_by_kg_without_cartons(company, owner):
    supplier = _supplier(company)
    liver = _cut_product(company, name_ar="كبده")
    inv = _create(
        company, supplier, owner,
        [_line(liver, quantity_kg="25", unit_price="4", vat_rate=Decimal("0"))],
        vat_rate=Decimal("0"),
    )
    assert inv.vat_amount == Decimal("0.00")
    assert inv.total_amount == Decimal("100.00")
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="received")
    balance = InventoryBalance.objects.get(company=company, product=liver)
    assert balance.available_kg == Decimal("25.000")
    assert balance.available_cartons == Decimal("0.00")
    layer = FIFOStockLayer.objects.get(
        company=company, source_type=StockSourceType.PURCHASE_INVOICE, source_id=inv.id,
    )
    assert layer.remaining_kg == Decimal("25.000")
    assert layer.unit_cost_per_kg == Decimal("4.0000")
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("100.00")


def test_purchase_cut_requires_kg_on_approve(company, owner):
    supplier = _supplier(company)
    liver = _cut_product(company)
    inv = _create(
        company, supplier, owner,
        [_line(liver, quantity_kg="0", unit_price="4")],
    )
    with pytest.raises(ValidationError):
        services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")


def test_api_purchase_cut_without_cartons(api, company, owner):
    supplier = _supplier(company)
    liver = _cut_product(company, sku="API-LIVER")
    api.force_authenticate(owner)
    resp = api.post(
        PURCHASES_URL,
        {
            "supplier": supplier.id,
            "invoice_date": str(date.today()),
            "vat_rate": "0.00",
            "lines": [{
                "product": liver.id,
                "line_type": "product",
                "quantity_cartons": "0",
                "quantity_pieces": "0",
                "quantity_kg": "25.000",
                "unit_price": "4.00",
                "price_type": "kg",
                "vat_rate": "0.00",
            }],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    inv_id = resp.data["id"]
    resp = api.post(
        f"{PURCHASES_URL}{inv_id}/approve/",
        {"reason": "cuts received"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    balance = InventoryBalance.objects.get(company=company, product=liver)
    assert balance.available_kg == Decimal("25.000")


def test_cash_purchase_approve_deducts_cashbox(company, owner):
    supplier = _supplier(company, sku="SCASH")
    product = _product(company, sku="PCASH")
    cashbox = MoneyAccount.objects.create(
        company=company,
        name="Main Cash",
        account_type="cashbox",
        opening_balance=Decimal("1000"),
        current_balance=Decimal("1000"),
        currency="AED",
    )
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="cash",
        amount_paid=Decimal("60"),
        money_account=cashbox,
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="cash buy")
    cashbox.refresh_from_db()
    supplier.refresh_from_db()
    assert cashbox.current_balance == Decimal("940.00")
    assert supplier.current_balance == Decimal("40.00")
    assert MoneyMovement.objects.filter(
        company=company,
        movement_type=MoneyMovementType.PURCHASE_PAYMENT,
        reference_type="purchase_invoice",
        reference_id=str(inv.id),
    ).exists()


def test_bank_purchase_approve_deducts_bank_account(company, owner):
    supplier = _supplier(company, sku="SBANK")
    product = _product(company, sku="PBANK")
    bank = MoneyAccount.objects.create(
        company=company,
        name="ENBD",
        account_type="bank",
        opening_balance=Decimal("500"),
        current_balance=Decimal("500"),
        currency="AED",
    )
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="bank_transfer",
        amount_paid=Decimal("25"),
        money_account=bank,
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="bank buy")
    bank.refresh_from_db()
    supplier.refresh_from_db()
    assert bank.current_balance == Decimal("475.00")
    assert supplier.current_balance == Decimal("75.00")


def test_approve_backdated_credit_purchase_null_optional_fks(company, owner):
    """PostgreSQL regression: null money_account / deduction suppliers must not 500 on approve.

    PINV-00019 on firstview failed with:
    NotSupportedError: FOR UPDATE cannot be applied to the nullable side of an outer join
  """
    from datetime import timedelta

    supplier = _supplier(company, sku="PREG")
    product = _product(company, sku="PREG-P")
    past = date.today() - timedelta(days=6)
    inv = services.create_purchase_invoice(
        company=company,
        supplier=supplier,
        created_by=owner,
        invoice_date=past,
        backdate_reason="سبب تاريخ سابق",
        payment_method="credit",
        amount_paid=Decimal("0"),
        money_account=None,
        vat_rate=Decimal("0"),
        slaughterhouse_supplier=None,
        transport_supplier=None,
        lines=[_line(product, quantity_kg="15", unit_price="10", price_type="kg")],
    )
    approved = services.approve_purchase_invoice(
        invoice=inv,
        user=owner,
        reason="اعتماد فاتورة آجلة",
        backdate_reason="سبب تاريخ سابق",
    )
    assert approved.status == PurchaseStatus.APPROVED
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("150.00")


def test_credit_purchase_posts_supplier_payable_only(company, owner):
    supplier = _supplier(company, sku="SCRED")
    product = _product(company, sku="PCRED")
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="credit",
        amount_paid=Decimal("0"),
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="credit buy")
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("100.00")


def test_partial_purchase_posts_outstanding_supplier_payable(company, owner):
    supplier = _supplier(company, sku="SPART")
    product = _product(company, sku="PPART")
    cashbox = MoneyAccount.objects.create(
        company=company,
        name="Petty Cash",
        account_type="cashbox",
        opening_balance=Decimal("500"),
        current_balance=Decimal("500"),
        currency="AED",
    )
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="cash",
        amount_paid=Decimal("30"),
        money_account=cashbox,
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="partial")
    supplier.refresh_from_db()
    assert supplier.current_balance == Decimal("70.00")


def test_cancel_reverses_purchase_money_movement(company, owner):
    supplier = _supplier(company, sku="SCAN")
    product = _product(company, sku="PCAN")
    cashbox = MoneyAccount.objects.create(
        company=company,
        name="Cancel Cash",
        account_type="cashbox",
        opening_balance=Decimal("300"),
        current_balance=Decimal("300"),
        currency="AED",
    )
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="cash",
        amount_paid=Decimal("20"),
        money_account=cashbox,
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="approve")
    services.cancel_purchase_invoice(invoice=inv, user=owner, reason="cancel")
    cashbox.refresh_from_db()
    supplier.refresh_from_db()
    assert cashbox.current_balance == Decimal("300.00")
    assert supplier.current_balance == Decimal("0.00")


# ── Production data hygiene checks ──────────────────────────────────────────
def test_deploy_scripts_do_not_seed_demo_data():
    scripts_dir = REPO_ROOT / "scripts"
    forbidden = [
        "seed_initial --demo", "seed_product_foundation",
        "seed_customer_supplier_demo", "seed_inventory_demo", "seed_purchase_demo",
    ]
    # Only the actual deploy scripts. The data-hygiene detector
    # (check_no_production_mock_data.sh) intentionally references these tokens.
    deploy_scripts = ["deploy_vps.sh", "local_release_deploy.sh"]
    for name in deploy_scripts:
        script = scripts_dir / name
        # Inspect only executable lines (ignore comments documenting the rule).
        code_lines = [
            line for line in script.read_text(encoding="utf-8").splitlines()
            if not line.lstrip().startswith("#")
        ]
        code = "\n".join(code_lines)
        for token in forbidden:
            assert token not in code, f"{script.name} must not run '{token}'"


def _service_supplier(company, code, name_ar, sku="SS"):
    cat, _ = SupplierCategory.objects.get_or_create(
        company=company, code=code,
        defaults={"name_ar": name_ar, "name_en": code},
    )
    return Supplier.objects.create(
        company=company, name_ar=name_ar, phone=f"050{sku}",
        supplier_type=SupplierType.CREDIT, category=cat,
    )


# ── Slaughterhouse / transport deductions ───────────────────────────────────
def test_purchase_with_slaughter_and_transport_deductions(company, owner):
    poultry = _supplier(company, sku="P1")
    slaughter = _service_supplier(company, "slaughterhouse", "مسلخ العين", "SH1")
    transport = _service_supplier(company, "transport", "نقل الإمارات", "TR1")
    product = _product(company)
    inv = _create(
        company, poultry, owner,
        [_line(product, quantity_kg="100", unit_price="100")],
        slaughterhouse_supplier=slaughter,
        slaughterhouse_deduction_amount=Decimal("600"),
        transport_supplier=transport,
        transport_deduction_amount=Decimal("400"),
    )
    assert inv.gross_total == Decimal("10000.00")
    assert inv.total_amount == Decimal("9000.00")
    assert inv.inventory_cost_total == Decimal("10000.00")

    services.approve_purchase_invoice(invoice=inv, user=owner, reason="approve")
    poultry.refresh_from_db()
    slaughter.refresh_from_db()
    transport.refresh_from_db()
    assert poultry.current_balance == Decimal("9000.00")
    assert slaughter.current_balance == Decimal("600.00")
    assert transport.current_balance == Decimal("400.00")
    assert SupplierLedgerEntry.objects.filter(
        supplier=slaughter, entry_type=SupplierLedgerEntry.EntryType.PURCHASE_DEDUCTION
    ).exists()
    layer = FIFOStockLayer.objects.get(
        company=company, source_type=StockSourceType.PURCHASE_INVOICE, source_id=inv.id
    )
    assert layer.unit_cost_per_kg == Decimal("100.0000")


def test_deduction_exceeds_gross_blocked(company, owner):
    poultry = _supplier(company)
    slaughter = _service_supplier(company, "slaughterhouse", "مسلخ", "SH2")
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(
            company, poultry, owner,
            [_line(product, quantity_kg="10", unit_price="100")],
            slaughterhouse_supplier=slaughter,
            slaughterhouse_deduction_amount=Decimal("1500"),
        )


def test_deduction_requires_account(company, owner):
    poultry = _supplier(company)
    product = _product(company)
    with pytest.raises(ValidationError):
        _create(
            company, poultry, owner,
            [_line(product, quantity_kg="10", unit_price="100")],
            slaughterhouse_deduction_amount=Decimal("100"),
        )


def test_draft_deductions_do_not_affect_balances(company, owner):
    poultry = _supplier(company)
    slaughter = _service_supplier(company, "slaughterhouse", "مسلخ", "SH3")
    product = _product(company)
    _create(
        company, poultry, owner,
        [_line(product, quantity_kg="10", unit_price="100")],
        slaughterhouse_supplier=slaughter,
        slaughterhouse_deduction_amount=Decimal("200"),
    )
    poultry.refresh_from_db()
    slaughter.refresh_from_db()
    assert poultry.current_balance == Decimal("0.00")
    assert slaughter.current_balance == Decimal("0.00")


def test_cash_purchase_pays_net_supplier_amount(company, owner):
    from apps.payments.models import MoneyAccount, MoneyAccountType

    poultry = _supplier(company)
    slaughter = _service_supplier(company, "slaughterhouse", "مسلخ", "SH4")
    product = _product(company)
    cashbox = MoneyAccount.objects.create(
        company=company, name="Main Cash", account_type=MoneyAccountType.CASHBOX,
        currency="AED", opening_balance=Decimal("50000"), current_balance=Decimal("50000"),
    )
    inv = _create(
        company, poultry, owner,
        [_line(product, quantity_kg="10", unit_price="100")],
        slaughterhouse_supplier=slaughter,
        slaughterhouse_deduction_amount=Decimal("200"),
        payment_method="cash",
        amount_paid=Decimal("800"),
        money_account=cashbox,
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="cash")
    poultry.refresh_from_db()
    assert poultry.current_balance == Decimal("0.00")
    assert MoneyMovement.objects.filter(
        company=company, movement_type=MoneyMovementType.PURCHASE_PAYMENT, amount=Decimal("800")
    ).exists()


# ── Payment source / account type validation ────────────────────────────────
def _cashbox(company, name="Cash A", balance="1000"):
    return MoneyAccount.objects.create(
        company=company, name=name, account_type="cashbox",
        opening_balance=Decimal(balance), current_balance=Decimal(balance),
        currency="AED",
    )


def _bank(company, name="ADCB", balance="1000"):
    return MoneyAccount.objects.create(
        company=company, name=name, account_type="bank", bank_name=name,
        account_number="123456", opening_balance=Decimal(balance),
        current_balance=Decimal(balance), currency="AED",
    )


def test_cash_purchase_cannot_use_bank_account(company, owner):
    supplier = _supplier(company, sku="SMIX1")
    product = _product(company, sku="PMIX1")
    bank = _bank(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="cash", amount_paid=Decimal("50"),
        money_account=bank, vat_rate=Decimal("0"),
    )
    with pytest.raises(ValidationError):
        services.approve_purchase_invoice(invoice=inv, user=owner, reason="x")


def test_bank_purchase_cannot_use_cashbox(company, owner):
    supplier = _supplier(company, sku="SMIX2")
    product = _product(company, sku="PMIX2")
    cashbox = _cashbox(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="bank_transfer", amount_paid=Decimal("50"),
        money_account=cashbox, vat_rate=Decimal("0"),
    )
    with pytest.raises(ValidationError):
        services.approve_purchase_invoice(invoice=inv, user=owner, reason="x")


def test_credit_purchase_cannot_use_money_account(company, owner):
    supplier = _supplier(company, sku="SMIX3")
    product = _product(company, sku="PMIX3")
    cashbox = _cashbox(company)
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="credit", amount_paid=Decimal("0"),
        money_account=cashbox, vat_rate=Decimal("0"),
    )
    with pytest.raises(ValidationError):
        services.approve_purchase_invoice(invoice=inv, user=owner, reason="x")


def test_insufficient_cashbox_balance_blocks_purchase(company, owner):
    supplier = _supplier(company, sku="SMIX4")
    product = _product(company, sku="PMIX4")
    cashbox = _cashbox(company, balance="10")
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_kg="10", unit_price="10")],
        payment_method="cash", amount_paid=Decimal("100"),
        money_account=cashbox, vat_rate=Decimal("0"),
    )
    with pytest.raises(ValidationError):
        services.approve_purchase_invoice(invoice=inv, user=owner, reason="x")
    cashbox.refresh_from_db()
    assert cashbox.current_balance == Decimal("10.00")


# ── KG-based purchase pricing (client blocker: pieces × price bug) ──────────
def test_kg_priced_line_ignores_pieces(company, owner):
    """price_type=kg must use kg × unit_price even when pieces are present."""
    supplier = _supplier(company, sku="SKG1")
    product = _product(company, sku="PKG1")
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_cartons="10", quantity_pieces="100",
               quantity_kg="3344.8", unit_price="14.5", price_type="kg")],
        vat_rate=Decimal("0"),
    )
    line = inv.lines.first()
    assert line.line_subtotal == Decimal("3344.8") * Decimal("14.5")
    assert inv.total_amount == (Decimal("3344.8") * Decimal("14.5")).quantize(Decimal("0.01"))


def test_carton_product_kg_total_via_api(api, company, owner):
    """Fixed-weight carton product: derived KG × price per KG, not pieces × price."""
    supplier = _supplier(company, sku="SKG2")
    # 1000 g per piece, 10 pieces per carton → 10 kg per carton.
    product = _product(company, sku="PKG2")
    api.force_authenticate(owner)
    resp = api.post(
        "/api/v1/tenant/purchases/",
        {
            "supplier": supplier.id,
            "invoice_date": str(date.today()),
            "vat_rate": "0",
            "lines": [{
                "product": product.id, "line_type": "product",
                "quantity_cartons": "5", "quantity_pieces": "50",
                "quantity_kg": "50", "unit_price": "10", "price_type": "kg",
            }],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    line = resp.data["lines"][0]
    # 50 kg × 10 = 500 (NOT 50 pieces × 10 = 500 by coincidence of weight —
    # assert against kg explicitly by re-checking with a non-1kg weight below).
    assert Decimal(line["line_subtotal"]) == Decimal("500.00")

    heavy = Product.objects.create(
        company=company, category=product.category, name_ar="prod heavy",
        sku="PKG3", product_type=ProductType.FIXED_WEIGHT, weight_grams=1200,
        default_pieces_per_carton=10, purchase_price=Decimal("10.00"),
    )
    resp = api.post(
        "/api/v1/tenant/purchases/",
        {
            "supplier": supplier.id,
            "invoice_date": str(date.today()),
            "vat_rate": "0",
            "lines": [{
                "product": heavy.id, "line_type": "product",
                "quantity_cartons": "5", "quantity_pieces": "50",
                "quantity_kg": "60", "unit_price": "10", "price_type": "kg",
            }],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    line = resp.data["lines"][0]
    # 60 kg × 10 = 600 — pieces (50) must NOT drive the total.
    assert Decimal(line["line_subtotal"]) == Decimal("600.00")


def test_cut_product_manual_kg_total(company, owner):
    supplier = _supplier(company, sku="SKG4")
    liver = _cut_product(company, sku="CUTKG4")
    inv = _create(
        company, supplier, owner,
        [_line(liver, quantity_kg="25.5", unit_price="4", price_type="kg")],
        vat_rate=Decimal("0"),
    )
    line = inv.lines.first()
    assert line.line_subtotal == Decimal("102.00")


def test_kg_totals_survive_approval(company, owner):
    supplier = _supplier(company, sku="SKG5")
    product = _product(company, sku="PKG5")
    inv = _create(
        company, supplier, owner,
        [_line(product, quantity_cartons="2", quantity_pieces="20",
               quantity_kg="20", unit_price="14.5", price_type="kg")],
        vat_rate=Decimal("0"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    inv.refresh_from_db()
    line = inv.lines.first()
    assert line.line_subtotal == Decimal("290.00")
    assert inv.total_amount == Decimal("290.00")


def test_cancel_reverses_deduction_ledgers(company, owner):
    poultry = _supplier(company)
    slaughter = _service_supplier(company, "slaughterhouse", "مسلخ", "SH5")
    transport = _service_supplier(company, "transport", "نقل", "TR5")
    product = _product(company)
    inv = _create(
        company, poultry, owner,
        [_line(product, quantity_kg="10", unit_price="100")],
        slaughterhouse_supplier=slaughter,
        slaughterhouse_deduction_amount=Decimal("100"),
        transport_supplier=transport,
        transport_deduction_amount=Decimal("50"),
    )
    services.approve_purchase_invoice(invoice=inv, user=owner, reason="ok")
    services.cancel_purchase_invoice(invoice=inv, user=owner, reason="mistake")
    poultry.refresh_from_db()
    slaughter.refresh_from_db()
    transport.refresh_from_db()
    assert poultry.current_balance == Decimal("0.00")
    assert slaughter.current_balance == Decimal("0.00")
    assert transport.current_balance == Decimal("0.00")


def test_production_env_example_disables_demo_data():
    env_text = (REPO_ROOT / "backend" / ".env.production.example").read_text(encoding="utf-8")
    assert "ENABLE_DEMO_DATA=False" in env_text


def test_frontend_production_defaults_to_live_api():
    config = (REPO_ROOT / "frontend" / "src" / "services" / "config.ts").read_text(
        encoding="utf-8"
    )
    assert "VITE_USE_MOCK_DATA" in config
    assert "IS_MOCK_MODE" in config
    env_example = (REPO_ROOT / "frontend" / ".env.production.example").read_text(encoding="utf-8")
    assert "VITE_USE_MOCK_DATA=false" in env_example


def test_demo_seed_command_requires_confirmation(company, owner):
    from django.core.management import call_command
    from django.core.management.base import CommandError

    _supplier(company)
    _product(company)
    with pytest.raises(CommandError):
        call_command("seed_purchase_demo", "--company-subdomain", company.subdomain)
