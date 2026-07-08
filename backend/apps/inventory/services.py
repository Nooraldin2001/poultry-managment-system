"""Inventory domain services (Phase 3).

All stock-mutating logic lives here, not in views. Every mutation runs inside
``transaction.atomic`` and locks the affected ``InventoryBalance`` row with
``select_for_update`` so concurrent movements cannot create negative stock or
corrupt FIFO layers.

FIFO costing is normalized **per KG**. Layers are consumed oldest-first by
``received_at`` then ``created_at``. If a product is tracked only by cartons /
pieces (KG not meaningful), the KG dimension is simply zero and costing for that
product is best-effort (documented limitation).
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import create_audit_log

from .models import (
    AdjustmentStatus,
    AdjustmentType,
    FIFOStockLayer,
    InventoryBalance,
    MovementDirection,
    MovementType,
    StockAdjustment,
    StockMovement,
    StockSourceType,
    StocktakingLine,
    StocktakingLineStatus,
    StocktakingSession,
    StocktakingStatus,
)

ZERO = Decimal("0")
KG_Q = Decimal("0.001")
QTY_Q = Decimal("0.01")
MONEY_Q = Decimal("0.01")


class InventoryIntegrityError(Exception):
    """Raised when FIFO layers cannot satisfy a consumption the balance allows.

    This signals a data-integrity problem (layers and balance disagree) and is
    blocked to protect future profit calculations.
    """


class StockConsumedError(Exception):
    """Raised when a source's stock cannot be reversed because it was consumed.

    Used by :func:`reverse_source_layers` (e.g. purchase cancellation) to block
    reversing stock that has already been (partially) sold/consumed.
    """


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value if value is not None else 0))


# Maps a FIFO ``source_type`` to the corresponding inbound ``movement_type``.
_SOURCE_TO_MOVEMENT = {
    StockSourceType.OPENING_INVENTORY: MovementType.OPENING_INVENTORY,
    StockSourceType.MANUAL_INCREASE: MovementType.MANUAL_INCREASE,
    StockSourceType.PURCHASE_INVOICE: MovementType.PURCHASE_APPROVED,
    StockSourceType.STOCKTAKING_INCREASE: MovementType.STOCKTAKING_INCREASE,
    StockSourceType.ADJUSTMENT: MovementType.MANUAL_INCREASE,
    StockSourceType.REVERSAL: MovementType.REVERSAL,
}

# Sources that represent sensitive user actions needing an audit log.
_SENSITIVE_SOURCES = {
    StockSourceType.MANUAL_INCREASE,
    StockSourceType.OPENING_INVENTORY,
    StockSourceType.ADJUSTMENT,
}

_SOURCE_TO_AUDIT_ACTION = {
    StockSourceType.MANUAL_INCREASE: "manual_stock_adjustment",
    StockSourceType.OPENING_INVENTORY: "opening_inventory",
    StockSourceType.ADJUSTMENT: "manual_stock_adjustment",
}


# ── Balance helpers ─────────────────────────────────────────────────────────
def get_or_create_balance(company, product) -> InventoryBalance:
    """Return (creating if needed) the balance row for ``product``.

    Validates that the product belongs to ``company`` and tracks inventory.
    """
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})
    if not product.track_inventory:
        raise ValidationError({"product": "This product does not track inventory."})
    balance, _ = InventoryBalance.objects.get_or_create(
        company=company, product=product
    )
    return balance


def _lock_balance(company, product) -> InventoryBalance:
    """Lock (and lazily create) the balance row for update."""
    get_or_create_balance(company, product)
    return (
        InventoryBalance.objects.select_for_update()
        .select_related("product")
        .get(company=company, product=product)
    )


def _validate_quantities(cartons, pieces, kg, *, require_positive=True):
    cartons, pieces, kg = _d(cartons), _d(pieces), _d(kg)
    if cartons < 0 or pieces < 0 or kg < 0:
        raise ValidationError("Quantities cannot be negative.")
    if require_positive and cartons <= 0 and pieces <= 0 and kg <= 0:
        raise ValidationError("At least one quantity (cartons/pieces/kg) must be positive.")
    return cartons, pieces, kg


def _audit_balance_change(*, action, company, user, product, previous, balance,
                          reason, reference_type, reference_id):
    create_audit_log(
        action=action,
        user=user,
        company=company,
        module="inventory",
        reference_type=reference_type,
        reference_id=reference_id,
        previous_value=previous,
        new_value=_balance_snapshot(balance),
        reason=reason or "",
    )


def _balance_snapshot(balance) -> dict:
    return {
        "available_cartons": str(balance.available_cartons),
        "available_pieces": str(balance.available_pieces),
        "available_kg": str(balance.available_kg),
    }


# ── Add stock (inbound) ─────────────────────────────────────────────────────
@transaction.atomic
def add_stock(*, company, product, cartons=ZERO, pieces=ZERO, kg=ZERO,
              unit_cost_per_kg=ZERO, source_type, source_id=None,
              source_reference="", reason="", user=None, notes="",
              movement_type=None, received_at=None, movement_date=None) -> StockMovement:
    """Add stock: increases balance, creates a FIFO layer + inbound movement.

    Used now by opening inventory / manual increases; later by purchase
    approval. Costing is per-KG; ``total_cost = kg × unit_cost_per_kg``.
    """
    cartons, pieces, kg = _validate_quantities(cartons, pieces, kg)
    unit_cost_per_kg = _d(unit_cost_per_kg)
    if unit_cost_per_kg < 0:
        raise ValidationError({"unit_cost_per_kg": "Unit cost cannot be negative."})

    if source_type in _SENSITIVE_SOURCES and not (reason or "").strip():
        raise ValidationError({"reason": "Reason is required for this stock action."})

    balance = _lock_balance(company, product)
    previous = _balance_snapshot(balance)
    from datetime import datetime, time

    if movement_date is None:
        movement_date = (
            received_at.date() if received_at is not None else timezone.localdate()
        )
    if received_at is None:
        received_at = timezone.make_aware(datetime.combine(movement_date, time.min))

    total_cost = (kg * unit_cost_per_kg).quantize(MONEY_Q)
    FIFOStockLayer.objects.create(
        company=company, product=product, source_type=source_type,
        source_id=source_id, source_reference=source_reference,
        received_at=received_at,
        original_cartons=cartons, original_pieces=pieces, original_kg=kg,
        remaining_cartons=cartons, remaining_pieces=pieces, remaining_kg=kg,
        unit_cost_per_kg=unit_cost_per_kg, total_cost=total_cost,
        is_depleted=(cartons <= 0 and pieces <= 0 and kg <= 0),
        notes=notes,
    )

    balance.available_cartons = F("available_cartons") + cartons
    balance.available_pieces = F("available_pieces") + pieces
    balance.available_kg = F("available_kg") + kg
    balance.last_movement_at = received_at
    balance.save(update_fields=[
        "available_cartons", "available_pieces", "available_kg",
        "last_movement_at", "updated_at",
    ])
    balance.refresh_from_db()

    movement = StockMovement.objects.create(
        company=company, product=product,
        movement_type=movement_type or _SOURCE_TO_MOVEMENT.get(
            source_type, MovementType.MANUAL_INCREASE
        ),
        direction=MovementDirection.IN,
        reference_type=source_type, reference_id=source_id,
        reference_number=source_reference,
        cartons_delta=cartons, pieces_delta=pieces, kg_delta=kg,
        balance_cartons_after=balance.available_cartons,
        balance_pieces_after=balance.available_pieces,
        balance_kg_after=balance.available_kg,
        unit_cost_per_kg=unit_cost_per_kg,
        reason=reason, notes=notes, created_by=user,
        movement_date=movement_date,
    )

    if source_type in _SENSITIVE_SOURCES:
        _audit_balance_change(
            action=_SOURCE_TO_AUDIT_ACTION.get(source_type, "manual_stock_adjustment"),
            company=company, user=user, product=product, previous=previous,
            balance=balance, reason=reason,
            reference_type="stock_movement", reference_id=movement.id,
        )
    return movement


# ── Consume stock (outbound, FIFO) ──────────────────────────────────────────
def _available_layer_kg(company, product) -> Decimal:
    agg = (
        FIFOStockLayer.objects.filter(
            company=company, product=product, is_depleted=False
        ).aggregate(s=Sum("remaining_kg"))
    )
    return agg["s"] or ZERO


@transaction.atomic
def consume_stock_fifo_detailed(*, company, product, cartons=ZERO, pieces=ZERO, kg=ZERO,
                              reference_type="", reference_id=None, reference_number="",
                              reason="", user=None, notes="",
                              movement_type=MovementType.MANUAL_DECREASE,
                              audit_action=None, movement_date=None):
    """Consume stock oldest-first; returns ``(movement, allocations)``.

    ``allocations`` is a list of dicts with layer + quantities consumed, for
  sales profit traceability and cancellation stock return.
    """
    cartons, pieces, kg = _validate_quantities(cartons, pieces, kg)
    balance = _lock_balance(company, product)
    previous = _balance_snapshot(balance)

    if (
        cartons > balance.available_cartons
        or pieces > balance.available_pieces
        or kg > balance.available_kg
    ):
        raise ValidationError(
            "Insufficient stock: requested quantity exceeds available balance."
        )

    if kg > ZERO and kg > _available_layer_kg(company, product):
        raise InventoryIntegrityError(
            "FIFO layers do not cover the requested KG; refusing to consume to "
            "protect cost/profit integrity."
        )

    layers = list(
        FIFOStockLayer.objects.select_for_update()
        .filter(company=company, product=product, is_depleted=False)
        .order_by("received_at", "created_at", "id")
    )

    need_cartons, need_pieces, need_kg = cartons, pieces, kg
    fifo_cost_consumed = ZERO
    allocations = []

    for layer in layers:
        if need_cartons <= 0 and need_pieces <= 0 and need_kg <= 0:
            break
        take_kg = min(layer.remaining_kg, need_kg) if need_kg > 0 else ZERO
        take_cartons = min(layer.remaining_cartons, need_cartons) if need_cartons > 0 else ZERO
        take_pieces = min(layer.remaining_pieces, need_pieces) if need_pieces > 0 else ZERO

        if take_kg <= 0 and take_cartons <= 0 and take_pieces <= 0:
            continue

        layer.remaining_kg -= take_kg
        layer.remaining_cartons -= take_cartons
        layer.remaining_pieces -= take_pieces
        layer.is_depleted = (
            layer.remaining_kg <= 0
            and layer.remaining_cartons <= 0
            and layer.remaining_pieces <= 0
        )
        layer.save(update_fields=[
            "remaining_kg", "remaining_cartons", "remaining_pieces",
            "is_depleted", "updated_at",
        ])

        cost_share = (take_kg * layer.unit_cost_per_kg).quantize(MONEY_Q)
        fifo_cost_consumed += cost_share
        allocations.append({
            "fifo_layer": layer,
            "quantity_kg": take_kg,
            "quantity_cartons": take_cartons,
            "quantity_pieces": take_pieces,
            "unit_cost_per_kg": layer.unit_cost_per_kg,
            "cost_amount": cost_share,
        })
        need_cartons -= take_cartons
        need_pieces -= take_pieces
        need_kg -= take_kg

    if need_kg > Decimal("0.0001"):
        raise InventoryIntegrityError(
            "FIFO layers exhausted before satisfying requested KG."
        )

    fifo_cost_consumed = fifo_cost_consumed.quantize(MONEY_Q)

    balance.available_cartons = F("available_cartons") - cartons
    balance.available_pieces = F("available_pieces") - pieces
    balance.available_kg = F("available_kg") - kg
    balance.last_movement_at = timezone.now()
    balance.save(update_fields=[
        "available_cartons", "available_pieces", "available_kg",
        "last_movement_at", "updated_at",
    ])
    balance.refresh_from_db()

    if movement_date is None:
        movement_date = timezone.localdate()

    movement = StockMovement.objects.create(
        company=company, product=product, movement_type=movement_type,
        direction=MovementDirection.OUT,
        reference_type=reference_type, reference_id=reference_id,
        reference_number=reference_number,
        cartons_delta=-cartons, pieces_delta=-pieces, kg_delta=-kg,
        balance_cartons_after=balance.available_cartons,
        balance_pieces_after=balance.available_pieces,
        balance_kg_after=balance.available_kg,
        fifo_cost_consumed=fifo_cost_consumed,
        reason=reason, notes=notes, created_by=user,
        movement_date=movement_date,
    )

    if audit_action:
        _audit_balance_change(
            action=audit_action, company=company, user=user, product=product,
            previous=previous, balance=balance, reason=reason,
            reference_type="stock_movement", reference_id=movement.id,
        )
    return movement, allocations


@transaction.atomic
def consume_stock_fifo(*, company, product, cartons=ZERO, pieces=ZERO, kg=ZERO,
                       reference_type="", reference_id=None, reference_number="",
                       reason="", user=None, notes="",
                       movement_type=MovementType.MANUAL_DECREASE,
                       audit_action=None) -> StockMovement:
    """Consume stock oldest-first. Never allows negative balance/layers."""
    movement, _ = consume_stock_fifo_detailed(
        company=company, product=product, cartons=cartons, pieces=pieces, kg=kg,
        reference_type=reference_type, reference_id=reference_id,
        reference_number=reference_number, reason=reason, user=user, notes=notes,
        movement_type=movement_type, audit_action=audit_action,
    )
    return movement


# ── Correction (set to a new physical count) ────────────────────────────────
@transaction.atomic
def correct_stock(*, company, product, new_cartons, new_pieces, new_kg,
                  reason, user=None, notes="", unit_cost_per_kg=ZERO):
    """Set the balance to a new physical count, appending movements only.

    Positive differences add stock (new FIFO layer); negative differences
    consume FIFO oldest-first. Returns a dict with the increase/decrease
    movements (either may be ``None``).
    """
    if not (reason or "").strip():
        raise ValidationError({"reason": "Reason is required for a correction."})
    new_cartons, new_pieces, new_kg = _validate_quantities(
        new_cartons, new_pieces, new_kg, require_positive=False
    )
    balance = _lock_balance(company, product)

    inc_cartons = max(new_cartons - balance.available_cartons, ZERO)
    inc_pieces = max(new_pieces - balance.available_pieces, ZERO)
    inc_kg = max(new_kg - balance.available_kg, ZERO)
    dec_cartons = max(balance.available_cartons - new_cartons, ZERO)
    dec_pieces = max(balance.available_pieces - new_pieces, ZERO)
    dec_kg = max(balance.available_kg - new_kg, ZERO)

    decrease_mv = increase_mv = None
    if dec_cartons > 0 or dec_pieces > 0 or dec_kg > 0:
        decrease_mv = consume_stock_fifo(
            company=company, product=product,
            cartons=dec_cartons, pieces=dec_pieces, kg=dec_kg,
            reference_type="correction", reason=reason, user=user, notes=notes,
            movement_type=MovementType.CORRECTION,
        )
    if inc_cartons > 0 or inc_pieces > 0 or inc_kg > 0:
        increase_mv = add_stock(
            company=company, product=product,
            cartons=inc_cartons, pieces=inc_pieces, kg=inc_kg,
            unit_cost_per_kg=unit_cost_per_kg,
            source_type=StockSourceType.ADJUSTMENT, reason=reason, user=user,
            notes=notes, movement_type=MovementType.CORRECTION,
        )

    balance.refresh_from_db()
    create_audit_log(
        action="inventory_correction", user=user, company=company,
        module="inventory", reference_type="product", reference_id=product.id,
        previous_value=None, new_value=_balance_snapshot(balance), reason=reason,
    )
    return {"increase_movement": increase_mv, "decrease_movement": decrease_mv,
            "balance": balance}


# ── Manual adjustment (increase / decrease / correction) ────────────────────
@transaction.atomic
def apply_stock_adjustment(*, company, product, adjustment_type, reason, user=None,
                           cartons=ZERO, pieces=ZERO, kg=ZERO,
                           new_cartons=None, new_pieces=None, new_kg=None,
                           unit_cost_per_kg=ZERO, notes="", attachment=None
                           ) -> StockAdjustment:
    """Create and apply a :class:`StockAdjustment` (direct, authorized)."""
    if not (reason or "").strip():
        raise ValidationError({"reason": "Reason is required for a stock adjustment."})

    balance = _lock_balance(company, product)
    current = {
        "cartons": balance.available_cartons,
        "pieces": balance.available_pieces,
        "kg": balance.available_kg,
    }

    if adjustment_type == AdjustmentType.INCREASE:
        movement = add_stock(
            company=company, product=product, cartons=cartons, pieces=pieces, kg=kg,
            unit_cost_per_kg=unit_cost_per_kg,
            source_type=StockSourceType.MANUAL_INCREASE, reason=reason, user=user,
            notes=notes, movement_type=MovementType.MANUAL_INCREASE,
        )
        adj_cartons, adj_pieces, adj_kg = _d(cartons), _d(pieces), _d(kg)
    elif adjustment_type == AdjustmentType.DECREASE:
        movement = consume_stock_fifo(
            company=company, product=product, cartons=cartons, pieces=pieces, kg=kg,
            reference_type="stock_adjustment", reason=reason, user=user, notes=notes,
            movement_type=MovementType.MANUAL_DECREASE,
            audit_action="manual_stock_adjustment",
        )
        adj_cartons, adj_pieces, adj_kg = -_d(cartons), -_d(pieces), -_d(kg)
    elif adjustment_type == AdjustmentType.CORRECTION:
        result = correct_stock(
            company=company, product=product,
            new_cartons=_d(new_cartons), new_pieces=_d(new_pieces), new_kg=_d(new_kg),
            reason=reason, user=user, notes=notes, unit_cost_per_kg=unit_cost_per_kg,
        )
        movement = result["decrease_movement"] or result["increase_movement"]
        adj_cartons = _d(new_cartons) - current["cartons"]
        adj_pieces = _d(new_pieces) - current["pieces"]
        adj_kg = _d(new_kg) - current["kg"]
    else:
        raise ValidationError({"adjustment_type": "Unknown adjustment type."})

    balance.refresh_from_db()
    adjustment = StockAdjustment.objects.create(
        company=company, product=product, adjustment_type=adjustment_type,
        current_cartons=current["cartons"], current_pieces=current["pieces"],
        current_kg=current["kg"],
        adjustment_cartons=adj_cartons, adjustment_pieces=adj_pieces, adjustment_kg=adj_kg,
        new_cartons=balance.available_cartons, new_pieces=balance.available_pieces,
        new_kg=balance.available_kg,
        unit_cost_per_kg=_d(unit_cost_per_kg) if unit_cost_per_kg else None,
        reason=reason, notes=notes, attachment=attachment,
        applied_by=user, related_movement=movement,
        status=AdjustmentStatus.APPLIED,
    )
    return adjustment


# ── Stocktaking ─────────────────────────────────────────────────────────────
def _next_session_number(company) -> str:
    count = StocktakingSession.objects.filter(company=company).count() + 1
    return f"ST-{timezone.now():%Y%m}-{count:04d}"


@transaction.atomic
def create_stocktaking_session(*, company, count_date=None, reason="", notes="",
                               user=None, generate_lines=False) -> StocktakingSession:
    """Create a draft stocktaking session, optionally pre-filling lines."""
    session = StocktakingSession.objects.create(
        company=company, session_number=_next_session_number(company),
        status=StocktakingStatus.DRAFT,
        count_date=count_date or timezone.now().date(),
        started_by=user, reason=reason, notes=notes,
    )
    if generate_lines:
        balances = (
            InventoryBalance.objects.select_related("product")
            .filter(company=company, product__is_active=True,
                    product__track_inventory=True)
        )
        for balance in balances:
            add_stocktaking_line(
                company=company, session=session, product=balance.product,
                actual_cartons=balance.available_cartons,
                actual_pieces=balance.available_pieces,
                actual_kg=balance.available_kg,
            )
    return session


def add_stocktaking_line(*, company, session, product, actual_cartons=ZERO,
                         actual_pieces=ZERO, actual_kg=ZERO, reason="", notes="",
                         unit_cost_per_kg=None) -> StocktakingLine:
    """Add (or replace) a count line snapshotting current system quantities."""
    if session.status != StocktakingStatus.DRAFT:
        raise ValidationError("Cannot modify lines of a non-draft session.")
    if product.company_id != company.id:
        raise ValidationError({"product": "Product does not belong to this company."})

    balance = get_or_create_balance(company, product)
    line, _ = StocktakingLine.objects.get_or_create(
        company=company, session=session, product=product
    )
    line.system_cartons = balance.available_cartons
    line.system_pieces = balance.available_pieces
    line.system_kg = balance.available_kg
    line.actual_cartons = _d(actual_cartons)
    line.actual_pieces = _d(actual_pieces)
    line.actual_kg = _d(actual_kg)
    line.reason = reason
    line.notes = notes
    line.unit_cost_per_kg = unit_cost_per_kg
    line.recompute_difference()
    line.save()
    return line


def update_stocktaking_line(*, line, **fields) -> StocktakingLine:
    if line.session.status != StocktakingStatus.DRAFT:
        raise ValidationError("Cannot modify lines of a non-draft session.")
    for field in ("actual_cartons", "actual_pieces", "actual_kg", "reason",
                  "notes", "unit_cost_per_kg"):
        if field in fields and fields[field] is not None:
            setattr(line, field, fields[field])
    line.recompute_difference()
    line.save()
    return line


@transaction.atomic
def apply_stocktaking_session(*, session, reason, user=None) -> StocktakingSession:
    """Apply all line differences as movements; mark the session applied."""
    if not (reason or "").strip():
        raise ValidationError({"reason": "Reason is required to apply stocktaking."})
    if session.status != StocktakingStatus.DRAFT:
        raise ValidationError("Only a draft stocktaking session can be applied.")

    company = session.company
    lines = (
        StocktakingLine.objects.select_related("product")
        .filter(session=session)
        .order_by("id")
    )
    now = timezone.now()
    for line in lines:
        line.recompute_difference()
        inc_cartons = max(line.difference_cartons, ZERO)
        inc_pieces = max(line.difference_pieces, ZERO)
        inc_kg = max(line.difference_kg, ZERO)
        dec_cartons = max(-line.difference_cartons, ZERO)
        dec_pieces = max(-line.difference_pieces, ZERO)
        dec_kg = max(-line.difference_kg, ZERO)

        movement = None
        if dec_cartons > 0 or dec_pieces > 0 or dec_kg > 0:
            movement = consume_stock_fifo(
                company=company, product=line.product,
                cartons=dec_cartons, pieces=dec_pieces, kg=dec_kg,
                reference_type="stocktaking", reference_id=session.id,
                reference_number=session.session_number,
                reason=line.reason or reason, user=user,
                movement_type=MovementType.STOCKTAKING_DECREASE,
            )
        if inc_cartons > 0 or inc_pieces > 0 or inc_kg > 0:
            cost = line.unit_cost_per_kg
            if cost is None:
                cost = _latest_unit_cost(company, line.product)
            movement = add_stock(
                company=company, product=line.product,
                cartons=inc_cartons, pieces=inc_pieces, kg=inc_kg,
                unit_cost_per_kg=cost,
                source_type=StockSourceType.STOCKTAKING_INCREASE,
                source_id=session.id, source_reference=session.session_number,
                reason=line.reason or reason, user=user,
                movement_type=MovementType.STOCKTAKING_INCREASE,
            )
        if movement is not None:
            line.related_movement = movement
            line.save(update_fields=["related_movement", "updated_at"])

        # Refresh the product's last_stocktaking_at marker.
        InventoryBalance.objects.filter(
            company=company, product=line.product
        ).update(last_stocktaking_at=now)

    session.status = StocktakingStatus.APPLIED
    session.applied_by = user
    session.applied_at = now
    session.reason = reason
    session.save(update_fields=["status", "applied_by", "applied_at", "reason", "updated_at"])

    create_audit_log(
        action="stocktaking_apply", user=user, company=company, module="inventory",
        reference_type="stocktaking_session", reference_id=session.id,
        new_value={"session_number": session.session_number,
                   "lines": lines.count()},
        reason=reason,
    )
    return session


def _latest_unit_cost(company, product) -> Decimal:
    """Best-effort cost for a stocktaking increase: most recent layer cost."""
    layer = (
        FIFOStockLayer.objects.filter(company=company, product=product)
        .order_by("-received_at", "-created_at")
        .first()
    )
    return layer.unit_cost_per_kg if layer else ZERO


# ── Reporting / valuation ───────────────────────────────────────────────────
def estimate_fifo_value(company, product=None) -> Decimal:
    """Σ(remaining_kg × unit_cost_per_kg) over non-depleted FIFO layers."""
    qs = FIFOStockLayer.objects.filter(company=company, is_depleted=False)
    if product is not None:
        qs = qs.filter(product=product)
    total = ZERO
    for remaining_kg, unit_cost in qs.values_list("remaining_kg", "unit_cost_per_kg"):
        total += (remaining_kg or ZERO) * (unit_cost or ZERO)
    return total.quantize(MONEY_Q)


def get_inventory_summary(company) -> dict:
    balances = (
        InventoryBalance.objects.select_related("product")
        .filter(company=company)
    )
    agg = balances.aggregate(
        total_cartons=Sum("available_cartons"),
        total_pieces=Sum("available_pieces"),
        total_kg=Sum("available_kg"),
    )
    active_products = 0
    low = 0
    out = 0
    last_movement_at = None
    for balance in balances:
        active_products += 1
        status = balance.stock_status
        if status == "low":
            low += 1
        elif status == "out_of_stock":
            out += 1
        if balance.last_movement_at and (
            last_movement_at is None or balance.last_movement_at > last_movement_at
        ):
            last_movement_at = balance.last_movement_at
    return {
        "total_cartons": agg["total_cartons"] or ZERO,
        "total_pieces": agg["total_pieces"] or ZERO,
        "total_kg": agg["total_kg"] or ZERO,
        "active_products_count": active_products,
        "low_stock_count": low,
        "out_of_stock_count": out,
        "estimated_fifo_value": estimate_fifo_value(company),
        "last_movement_at": last_movement_at,
    }


def get_product_movement_history(company, product):
    return (
        StockMovement.objects.filter(company=company, product=product)
        .order_by("-created_at", "-id")
    )


# ── Source reversal (e.g. purchase cancellation) ────────────────────────────
@transaction.atomic
def reverse_source_layers(*, company, source_type, source_id, reason, user=None,
                          reference_number="",
                          movement_type=MovementType.REVERSAL) -> list:
    """Reverse the FIFO layers created by a single source (e.g. a purchase).

    Only safe when *every* matching layer is fully intact (nothing consumed).
    If any matching layer has been partially/fully consumed, raises
    :class:`StockConsumedError` so the caller can block the operation cleanly.

    Returns the list of outbound reversal movements (empty if no layers exist
    for the source — e.g. cancelling a purchase with no stock-tracked lines).
    """
    layers = list(
        FIFOStockLayer.objects.select_for_update()
        .filter(company=company, source_type=source_type, source_id=source_id)
        .select_related("product")
        .order_by("product_id", "id")
    )
    if not layers:
        return []

    for layer in layers:
        if (
            layer.remaining_kg != layer.original_kg
            or layer.remaining_cartons != layer.original_cartons
            or layer.remaining_pieces != layer.original_pieces
        ):
            raise StockConsumedError(
                "Stock from this source has already been consumed; cannot reverse."
            )

    movements = []
    now = timezone.now()
    for layer in layers:
        product = layer.product
        balance = _lock_balance(company, product)
        cartons = layer.original_cartons
        pieces = layer.original_pieces
        kg = layer.original_kg

        if (
            cartons > balance.available_cartons
            or pieces > balance.available_pieces
            or kg > balance.available_kg
        ):
            raise InventoryIntegrityError(
                "Balance is lower than the layer being reversed; refusing to "
                "create negative stock."
            )

        layer.remaining_cartons = ZERO
        layer.remaining_pieces = ZERO
        layer.remaining_kg = ZERO
        layer.is_depleted = True
        layer.save(update_fields=[
            "remaining_cartons", "remaining_pieces", "remaining_kg",
            "is_depleted", "updated_at",
        ])

        balance.available_cartons = F("available_cartons") - cartons
        balance.available_pieces = F("available_pieces") - pieces
        balance.available_kg = F("available_kg") - kg
        balance.last_movement_at = now
        balance.save(update_fields=[
            "available_cartons", "available_pieces", "available_kg",
            "last_movement_at", "updated_at",
        ])
        balance.refresh_from_db()

        movement = StockMovement.objects.create(
            company=company, product=product, movement_type=movement_type,
            direction=MovementDirection.OUT,
            reference_type=source_type, reference_id=source_id,
            reference_number=reference_number,
            cartons_delta=-cartons, pieces_delta=-pieces, kg_delta=-kg,
            balance_cartons_after=balance.available_cartons,
            balance_pieces_after=balance.available_pieces,
            balance_kg_after=balance.available_kg,
            unit_cost_per_kg=layer.unit_cost_per_kg,
            reason=reason, created_by=user,
            movement_date=timezone.localdate(),
        )
        movements.append(movement)
    return movements
