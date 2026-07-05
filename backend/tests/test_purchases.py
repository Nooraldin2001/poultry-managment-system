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
from apps.suppliers.models import Supplier, SupplierLedgerEntry, SupplierType

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
