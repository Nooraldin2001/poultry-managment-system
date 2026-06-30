"""Phase 3 inventory tests: services, balances, stocktaking, APIs, audit."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.inventory import services
from apps.inventory.models import (
    AdjustmentType,
    FIFOStockLayer,
    InventoryBalance,
    MovementType,
    StockAdjustment,
    StockMovement,
    StockSourceType,
    StocktakingStatus,
)
from apps.products.models import Product, ProductCategory, ProductType

pytestmark = pytest.mark.django_db


# ── Fixtures helpers ────────────────────────────────────────────────────────
def _product(company, sku="INV1", **kwargs):
    cat = ProductCategory.objects.create(company=company, name_ar="c", code=f"C{sku}")
    defaults = dict(
        company=company, category=cat, name_ar="prod", sku=sku,
        product_type=ProductType.FIXED_WEIGHT, weight_grams=1000,
        default_pieces_per_carton=10,
    )
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _add(company, product, **kwargs):
    params = dict(
        cartons=Decimal("0"), pieces=Decimal("0"), kg=Decimal("0"),
        unit_cost_per_kg=Decimal("12"), source_type=StockSourceType.PURCHASE_INVOICE,
    )
    params.update(kwargs)
    return services.add_stock(company=company, product=product, **params)


# ── Service: add_stock ──────────────────────────────────────────────────────
def test_add_stock_creates_balance_layer_movement(company):
    product = _product(company)
    movement = _add(company, product, cartons="10", pieces="100", kg="100")

    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("100.000")
    assert balance.available_cartons == Decimal("10.00")
    assert FIFOStockLayer.objects.filter(company=company, product=product).count() == 1
    assert movement.direction == "in"
    assert movement.balance_kg_after == Decimal("100.000")


def test_add_stock_increases_existing_balance(company):
    product = _product(company)
    _add(company, product, kg="50")
    _add(company, product, kg="30")
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("80.000")
    assert FIFOStockLayer.objects.filter(company=company, product=product).count() == 2


# ── Service: consume_stock_fifo ─────────────────────────────────────────────
def test_consume_reduces_oldest_layer_first(company):
    product = _product(company)
    old = timezone.now() - timedelta(days=2)
    _add(company, product, kg="10", unit_cost_per_kg="12", received_at=old)
    _add(company, product, kg="10", unit_cost_per_kg="15")

    services.consume_stock_fifo(company=company, product=product, kg="5")

    layers = list(
        FIFOStockLayer.objects.filter(company=company, product=product)
        .order_by("received_at")
    )
    assert layers[0].remaining_kg == Decimal("5.000")  # oldest consumed first
    assert layers[1].remaining_kg == Decimal("10.000")


def test_consume_calculates_cost_consumed_across_layers(company):
    product = _product(company)
    old = timezone.now() - timedelta(days=2)
    _add(company, product, kg="10", unit_cost_per_kg="12", received_at=old)
    _add(company, product, kg="10", unit_cost_per_kg="15")

    movement = services.consume_stock_fifo(company=company, product=product, kg="15")
    # 10kg @ 12 + 5kg @ 15 = 120 + 75 = 195
    assert movement.fifo_cost_consumed == Decimal("195.00")


def test_consume_blocks_insufficient_stock(company):
    product = _product(company)
    _add(company, product, kg="10")
    with pytest.raises(ValidationError):
        services.consume_stock_fifo(company=company, product=product, kg="20")


def test_consume_blocks_when_layers_do_not_cover_balance(company):
    product = _product(company)
    _add(company, product, kg="10")
    # Corrupt the balance so it claims more KG than the layers hold.
    InventoryBalance.objects.filter(company=company, product=product).update(
        available_kg=Decimal("20.000")
    )
    with pytest.raises(services.InventoryIntegrityError):
        services.consume_stock_fifo(company=company, product=product, kg="15")


def test_negative_quantities_rejected(company):
    product = _product(company)
    with pytest.raises(ValidationError):
        _add(company, product, kg="-5")


def test_unit_cost_cannot_be_negative(company):
    product = _product(company)
    with pytest.raises(ValidationError):
        _add(company, product, kg="5", unit_cost_per_kg="-1")


# ── Service: manual adjustment / correction ─────────────────────────────────
def test_manual_increase_creates_adjustment_movement_audit(company, owner):
    product = _product(company)
    adj = services.apply_stock_adjustment(
        company=company, product=product, adjustment_type=AdjustmentType.INCREASE,
        reason="found extra", user=owner, cartons="0", pieces="0", kg="20",
        unit_cost_per_kg="10",
    )
    assert isinstance(adj, StockAdjustment)
    assert adj.related_movement is not None
    assert StockMovement.objects.filter(
        company=company, product=product, movement_type=MovementType.MANUAL_INCREASE
    ).exists()
    assert AuditLog.objects.filter(
        company=company, action="manual_stock_adjustment"
    ).exists()


def test_manual_decrease_consumes_fifo_and_audits(company, owner):
    product = _product(company)
    _add(company, product, kg="20", unit_cost_per_kg="10")
    services.apply_stock_adjustment(
        company=company, product=product, adjustment_type=AdjustmentType.DECREASE,
        reason="spoilage", user=owner, kg="5",
    )
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.available_kg == Decimal("15.000")
    assert AuditLog.objects.filter(
        company=company, action="manual_stock_adjustment"
    ).exists()


def test_correction_increase_and_decrease(company, owner):
    product = _product(company)
    _add(company, product, kg="10", unit_cost_per_kg="10")

    services.correct_stock(
        company=company, product=product, new_cartons="0", new_pieces="0",
        new_kg="15", reason="recount up", user=owner, unit_cost_per_kg="10",
    )
    assert InventoryBalance.objects.get(company=company, product=product).available_kg == Decimal("15.000")

    services.correct_stock(
        company=company, product=product, new_cartons="0", new_pieces="0",
        new_kg="6", reason="recount down", user=owner,
    )
    assert InventoryBalance.objects.get(company=company, product=product).available_kg == Decimal("6.000")
    assert AuditLog.objects.filter(company=company, action="inventory_correction").count() == 2


# ── Balance tests ───────────────────────────────────────────────────────────
def test_balance_unique_per_company_product(company):
    product = _product(company)
    InventoryBalance.objects.create(company=company, product=product)
    with pytest.raises(IntegrityError):
        InventoryBalance.objects.create(company=company, product=product)


def test_cross_tenant_product_blocked(company, other_company):
    foreign = _product(other_company, sku="FOREIGN")
    with pytest.raises(ValidationError):
        services.get_or_create_balance(company, foreign)


def test_low_stock_status_computed(company):
    product = _product(company, minimum_stock_kg=Decimal("50.000"))
    _add(company, product, kg="10")
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.stock_status == "low"


def test_out_of_stock_status_computed(company):
    product = _product(company)
    services.get_or_create_balance(company, product)
    balance = InventoryBalance.objects.get(company=company, product=product)
    assert balance.stock_status == "out_of_stock"


# ── Stocktaking tests ───────────────────────────────────────────────────────
def test_create_and_count_stocktaking(company, owner):
    product = _product(company)
    _add(company, product, cartons="10", pieces="100", kg="100")
    session = services.create_stocktaking_session(company=company, user=owner)
    line = services.add_stocktaking_line(
        company=company, session=session, product=product,
        actual_cartons="9", actual_pieces="90", actual_kg="90",
    )
    assert line.system_kg == Decimal("100.000")
    assert line.difference_kg == Decimal("-10.000")
    assert line.status == "decrease"

    line = services.update_stocktaking_line(line=line, actual_kg=Decimal("110.000"))
    assert line.difference_kg == Decimal("10.000")
    assert line.status == "increase"


def test_apply_stocktaking_creates_movements(company, owner):
    product = _product(company)
    _add(company, product, kg="100", unit_cost_per_kg="10")
    session = services.create_stocktaking_session(company=company, user=owner)
    services.add_stocktaking_line(
        company=company, session=session, product=product, actual_kg="90",
    )
    services.apply_stocktaking_session(session=session, reason="annual count", user=owner)

    session.refresh_from_db()
    assert session.status == StocktakingStatus.APPLIED
    assert InventoryBalance.objects.get(company=company, product=product).available_kg == Decimal("90.000")
    assert StockMovement.objects.filter(
        company=company, movement_type=MovementType.STOCKTAKING_DECREASE
    ).exists()


def test_applying_stocktaking_twice_blocked(company, owner):
    product = _product(company)
    _add(company, product, kg="100", unit_cost_per_kg="10")
    session = services.create_stocktaking_session(company=company, user=owner)
    services.add_stocktaking_line(company=company, session=session, product=product, actual_kg="90")
    services.apply_stocktaking_session(session=session, reason="count", user=owner)
    with pytest.raises(ValidationError):
        services.apply_stocktaking_session(session=session, reason="again", user=owner)


def test_stocktaking_decrease_cannot_make_negative(company, owner):
    product = _product(company)
    _add(company, product, kg="100", unit_cost_per_kg="10")
    session = services.create_stocktaking_session(company=company, user=owner)
    line = services.add_stocktaking_line(
        company=company, session=session, product=product, actual_kg="0",
    )
    # Manually corrupt system snapshot to force an impossible decrease.
    line.system_kg = Decimal("200.000")
    line.recompute_difference()
    line.save()
    with pytest.raises(ValidationError):
        services.apply_stocktaking_session(session=session, reason="count", user=owner)


def test_stocktaking_apply_requires_reason(company, owner):
    product = _product(company)
    _add(company, product, kg="100", unit_cost_per_kg="10")
    session = services.create_stocktaking_session(company=company, user=owner)
    services.add_stocktaking_line(company=company, session=session, product=product, actual_kg="90")
    with pytest.raises(ValidationError):
        services.apply_stocktaking_session(session=session, reason="", user=owner)


def test_stocktaking_apply_audited(company, owner):
    product = _product(company)
    _add(company, product, kg="100", unit_cost_per_kg="10")
    session = services.create_stocktaking_session(company=company, user=owner)
    services.add_stocktaking_line(company=company, session=session, product=product, actual_kg="95")
    services.apply_stocktaking_session(session=session, reason="count", user=owner)
    assert AuditLog.objects.filter(company=company, action="stocktaking_apply").exists()


# ── API tests ───────────────────────────────────────────────────────────────
def test_owner_can_view_inventory(api, owner):
    api.force_authenticate(user=owner)
    assert api.get("/api/v1/tenant/inventory/").status_code == 200


def test_accountant_can_view_inventory(api, accountant):
    api.force_authenticate(user=accountant)
    assert api.get("/api/v1/tenant/inventory/").status_code == 200


def test_cashier_can_view_inventory(api, cashier):
    api.force_authenticate(user=cashier)
    assert api.get("/api/v1/tenant/inventory/").status_code == 200


def test_cashier_cannot_view_valuation(api, cashier):
    api.force_authenticate(user=cashier)
    assert api.get("/api/v1/tenant/inventory/valuation/").status_code == 403


def test_accountant_can_view_valuation(api, accountant):
    api.force_authenticate(user=accountant)
    assert api.get("/api/v1/tenant/inventory/valuation/").status_code == 200


def test_cashier_cannot_adjust_stock(api, cashier, fixed_product):
    api.force_authenticate(user=cashier)
    resp = api.post(
        "/api/v1/tenant/inventory/adjustments/",
        {"product": fixed_product.id, "adjustment_type": "increase",
         "kg": "5", "reason": "x"},
        format="json",
    )
    assert resp.status_code == 403


def test_accountant_cannot_adjust_by_default(api, accountant, fixed_product):
    api.force_authenticate(user=accountant)
    resp = api.post(
        "/api/v1/tenant/inventory/adjustments/",
        {"product": fixed_product.id, "adjustment_type": "increase",
         "kg": "5", "reason": "x"},
        format="json",
    )
    assert resp.status_code == 403


def test_owner_can_add_opening_stock(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/tenant/inventory/opening-stock/",
        {"product": fixed_product.id, "cartons": "5", "pieces": "50", "kg": "50",
         "unit_cost_per_kg": "12.00", "reason": "opening"},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    assert InventoryBalance.objects.get(
        company=owner.company, product=fixed_product
    ).available_kg == Decimal("50.000")


def test_owner_can_manually_adjust_stock(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/tenant/inventory/adjustments/",
        {"product": fixed_product.id, "adjustment_type": "increase",
         "kg": "10", "unit_cost_per_kg": "12", "reason": "found"},
        format="json",
    )
    assert resp.status_code == 201, resp.content


def test_adjustment_without_reason_rejected(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/tenant/inventory/adjustments/",
        {"product": fixed_product.id, "adjustment_type": "increase", "kg": "10"},
        format="json",
    )
    assert resp.status_code == 400


def test_cross_tenant_inventory_access_blocked(api, owner, other_owner):
    foreign = _product(other_owner.company, sku="FRGN")
    services.get_or_create_balance(other_owner.company, foreign)
    api.force_authenticate(user=owner)
    resp = api.get(f"/api/v1/tenant/inventory/products/{foreign.id}/")
    assert resp.status_code == 404


def test_movement_history_filters(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    api.post(
        "/api/v1/tenant/inventory/opening-stock/",
        {"product": fixed_product.id, "kg": "50", "unit_cost_per_kg": "12",
         "reason": "opening"},
        format="json",
    )
    resp = api.get(
        f"/api/v1/tenant/inventory/movements/?movement_type=opening_inventory&product={fixed_product.id}"
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_audit_log_created_for_api_adjustment(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    api.post(
        "/api/v1/tenant/inventory/adjustments/",
        {"product": fixed_product.id, "adjustment_type": "increase",
         "kg": "10", "unit_cost_per_kg": "12", "reason": "found"},
        format="json",
    )
    assert AuditLog.objects.filter(
        company=owner.company, action="manual_stock_adjustment"
    ).exists()


# ── Permission / catalog tests ──────────────────────────────────────────────
def test_inventory_permission_codes_seeded():
    from apps.permissions.models import PermissionCode

    for code in (
        "inventory.view", "inventory.view_movements", "inventory.view_valuation",
        "inventory.adjust", "inventory.export",
        "inventory.stocktaking.create", "inventory.stocktaking.apply",
        "inventory.settings.manage",
    ):
        assert PermissionCode.objects.filter(code=code).exists(), code


def test_seed_inventory_demo(company):
    from apps.inventory.seeders import seed_inventory_demo
    from apps.products.seeders import seed_product_foundation

    seed_product_foundation(company)
    count = seed_inventory_demo(company)
    assert count >= 4  # P900, P1000, P1100, LIV500, GIZ500 (P1200 is zero)

    p900 = Product.objects.get(company=company, sku="P900")
    balance = InventoryBalance.objects.get(company=company, product=p900)
    assert balance.available_kg == Decimal("306.000")
    assert services.estimate_fifo_value(company, p900) == Decimal("3672.00")  # 306 * 12

    # Idempotent: re-running adds nothing.
    assert seed_inventory_demo(company) == 0


def test_inventory_role_defaults(accountant, cashier):
    from apps.permissions.services import has_permission

    assert has_permission(accountant, "inventory.view")
    assert has_permission(accountant, "inventory.view_valuation")
    assert has_permission(accountant, "inventory.export")
    assert not has_permission(accountant, "inventory.adjust")
    assert not has_permission(accountant, "inventory.stocktaking.apply")

    assert has_permission(cashier, "inventory.view")
    assert not has_permission(cashier, "inventory.view_valuation")
    assert not has_permission(cashier, "inventory.adjust")
