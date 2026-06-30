"""Inventory domain models (Phase 3).

Design notes
------------
* One stock location per company (no warehouse split yet).
* ``InventoryBalance`` holds the *total* stock per product — this is what the UI
  shows. It is created lazily on the first movement/adjustment.
* ``FIFOStockLayer`` is the hidden backend ledger that powers FIFO valuation and
  future profit. FIFO cost is normalized **per KG** for now (see services).
* ``StockMovement`` is an append-only history; corrections happen by appending
  new movements, never by editing old rows.
* Negative stock is never allowed (enforced in services + DB check constraints).

See docs/backend/PHASE_3_INVENTORY_IMPLEMENTATION_NOTES.md.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import TenantOwnedModel, get_created_by_field

ZERO = Decimal("0")

# Quantity / money precision (kept consistent with products app).
QTY_CARTON = dict(max_digits=14, decimal_places=2)
QTY_PIECE = dict(max_digits=14, decimal_places=2)
QTY_KG = dict(max_digits=14, decimal_places=3)
COST_PER_KG = dict(max_digits=12, decimal_places=4)
MONEY = dict(max_digits=16, decimal_places=2)

_NON_NEG = [MinValueValidator(ZERO)]


class StockSourceType(models.TextChoices):
    PURCHASE_INVOICE = "purchase_invoice", "Purchase Invoice"
    MANUAL_INCREASE = "manual_increase", "Manual Increase"
    STOCKTAKING_INCREASE = "stocktaking_increase", "Stocktaking Increase"
    OPENING_INVENTORY = "opening_inventory", "Opening Inventory"
    ADJUSTMENT = "adjustment", "Adjustment"
    REVERSAL = "reversal", "Reversal"


class MovementType(models.TextChoices):
    PURCHASE_APPROVED = "purchase_approved", "Purchase Approved"
    SALES_APPROVED = "sales_approved", "Sales Approved"
    SALES_CANCELLED = "sales_cancelled", "Sales Cancelled"
    PURCHASE_CANCELLED = "purchase_cancelled", "Purchase Cancelled"
    MANUAL_INCREASE = "manual_increase", "Manual Increase"
    MANUAL_DECREASE = "manual_decrease", "Manual Decrease"
    CORRECTION = "correction", "Correction"
    STOCKTAKING_INCREASE = "stocktaking_increase", "Stocktaking Increase"
    STOCKTAKING_DECREASE = "stocktaking_decrease", "Stocktaking Decrease"
    OPENING_INVENTORY = "opening_inventory", "Opening Inventory"
    REVERSAL = "reversal", "Reversal"


class MovementDirection(models.TextChoices):
    IN = "in", "In"
    OUT = "out", "Out"
    NEUTRAL = "neutral", "Neutral"


class AdjustmentType(models.TextChoices):
    INCREASE = "increase", "Increase"
    DECREASE = "decrease", "Decrease"
    CORRECTION = "correction", "Correction"


class AdjustmentStatus(models.TextChoices):
    APPLIED = "applied", "Applied"
    REVERSED = "reversed", "Reversed"


class StocktakingStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    APPLIED = "applied", "Applied"
    CANCELLED = "cancelled", "Cancelled"


class StocktakingLineStatus(models.TextChoices):
    MATCHED = "matched", "Matched"
    INCREASE = "increase", "Increase"
    DECREASE = "decrease", "Decrease"
    NEEDS_REVIEW = "needs_review", "Needs Review"


class StockStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    LOW = "low", "Low"
    OUT_OF_STOCK = "out_of_stock", "Out of stock"
    NEEDS_REVIEW = "needs_review", "Needs review"


class InventoryBalance(TenantOwnedModel):
    """Current total stock per product for a company (UI source of truth)."""

    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="inventory_balance"
    )
    available_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    available_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    available_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)
    reserved_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    reserved_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    reserved_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)
    last_movement_at = models.DateTimeField(null=True, blank=True)
    last_stocktaking_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "product"], name="uniq_company_product_balance"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(available_cartons__gte=0)
                    & models.Q(available_pieces__gte=0)
                    & models.Q(available_kg__gte=0)
                ),
                name="inventory_balance_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "product"]),
            models.Index(fields=["company", "available_kg"]),
        ]

    def __str__(self):
        return f"Balance {self.product_id}: {self.available_kg}kg"

    @property
    def stock_status(self) -> str:
        product = self.product
        if self.available_cartons < 0 or self.available_pieces < 0 or self.available_kg < 0:
            return StockStatus.NEEDS_REVIEW
        if (
            self.available_cartons <= 0
            and self.available_pieces <= 0
            and self.available_kg <= 0
        ):
            return StockStatus.OUT_OF_STOCK
        low = False
        if product.minimum_stock_kg and self.available_kg < product.minimum_stock_kg:
            low = True
        if product.minimum_stock_cartons and self.available_cartons < product.minimum_stock_cartons:
            low = True
        if product.minimum_stock_pieces and self.available_pieces < product.minimum_stock_pieces:
            low = True
        return StockStatus.LOW if low else StockStatus.AVAILABLE


class FIFOStockLayer(TenantOwnedModel):
    """Hidden FIFO cost layer used for valuation and future profit.

    Costing is normalized to ``unit_cost_per_kg``. Layers are consumed oldest
    first (``received_at`` then ``created_at``).
    """

    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="fifo_layers"
    )
    source_type = models.CharField(max_length=24, choices=StockSourceType.choices)
    source_id = models.PositiveBigIntegerField(null=True, blank=True)
    source_reference = models.CharField(max_length=64, blank=True)
    received_at = models.DateTimeField(db_index=True)

    original_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    original_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    original_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)
    remaining_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    remaining_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    remaining_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)

    unit_cost_per_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **COST_PER_KG)
    total_cost = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    is_depleted = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["received_at", "created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(remaining_cartons__gte=0)
                    & models.Q(remaining_pieces__gte=0)
                    & models.Q(remaining_kg__gte=0)
                    & models.Q(unit_cost_per_kg__gte=0)
                    & models.Q(total_cost__gte=0)
                ),
                name="fifo_layer_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "product", "is_depleted", "received_at"]),
            models.Index(fields=["company", "source_type", "source_id"]),
        ]

    def __str__(self):
        return f"FIFO {self.product_id} {self.remaining_kg}/{self.original_kg}kg @ {self.unit_cost_per_kg}"


class StockMovement(TenantOwnedModel):
    """Append-only movement history for every inventory change."""

    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="stock_movements"
    )
    movement_type = models.CharField(max_length=24, choices=MovementType.choices)
    direction = models.CharField(max_length=8, choices=MovementDirection.choices)
    reference_type = models.CharField(max_length=64, blank=True)
    reference_id = models.PositiveBigIntegerField(null=True, blank=True)
    reference_number = models.CharField(max_length=64, blank=True)

    cartons_delta = models.DecimalField(default=ZERO, **QTY_CARTON)
    pieces_delta = models.DecimalField(default=ZERO, **QTY_PIECE)
    kg_delta = models.DecimalField(default=ZERO, **QTY_KG)

    balance_cartons_after = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    balance_pieces_after = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    balance_kg_after = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)

    fifo_cost_consumed = models.DecimalField(default=ZERO, validators=_NON_NEG, **MONEY)
    unit_cost_per_kg = models.DecimalField(null=True, blank=True, **COST_PER_KG)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = get_created_by_field("stock_movements_created")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(balance_cartons_after__gte=0)
                    & models.Q(balance_pieces_after__gte=0)
                    & models.Q(balance_kg_after__gte=0)
                ),
                name="stock_movement_balance_after_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "product", "created_at"]),
            models.Index(fields=["company", "movement_type"]),
            models.Index(fields=["company", "reference_type", "reference_id"]),
        ]

    def __str__(self):
        return f"{self.movement_type} {self.product_id} ({self.direction})"

    def save(self, *args, **kwargs):
        # Append-only: never update an existing movement.
        if self.pk is not None:
            raise ValueError("Stock movements are append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Stock movements are append-only and cannot be deleted.")


class StockAdjustment(TenantOwnedModel):
    """User-requested manual stock adjustment (applied directly)."""

    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="stock_adjustments"
    )
    adjustment_type = models.CharField(max_length=12, choices=AdjustmentType.choices)

    current_cartons = models.DecimalField(default=ZERO, **QTY_CARTON)
    current_pieces = models.DecimalField(default=ZERO, **QTY_PIECE)
    current_kg = models.DecimalField(default=ZERO, **QTY_KG)
    adjustment_cartons = models.DecimalField(default=ZERO, **QTY_CARTON)
    adjustment_pieces = models.DecimalField(default=ZERO, **QTY_PIECE)
    adjustment_kg = models.DecimalField(default=ZERO, **QTY_KG)
    new_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    new_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    new_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)

    unit_cost_per_kg = models.DecimalField(null=True, blank=True, **COST_PER_KG)
    reason = models.TextField()
    notes = models.TextField(blank=True)
    attachment = models.FileField(upload_to="stock_adjustments/", null=True, blank=True)

    applied_by = get_created_by_field("stock_adjustments_applied")
    applied_at = models.DateTimeField(auto_now_add=True)
    related_movement = models.ForeignKey(
        StockMovement, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="adjustment",
    )
    status = models.CharField(
        max_length=12, choices=AdjustmentStatus.choices, default=AdjustmentStatus.APPLIED
    )

    class Meta:
        ordering = ["-applied_at", "-id"]
        indexes = [
            models.Index(fields=["company", "product", "applied_at"]),
            models.Index(fields=["company", "adjustment_type"]),
        ]

    def __str__(self):
        return f"Adjustment {self.adjustment_type} {self.product_id}"


class StocktakingSession(TenantOwnedModel):
    """Inventory count event grouping line-level comparisons."""

    session_number = models.CharField(max_length=32)
    status = models.CharField(
        max_length=12, choices=StocktakingStatus.choices, default=StocktakingStatus.DRAFT
    )
    count_date = models.DateField()
    started_by = get_created_by_field("stocktaking_sessions_started")
    applied_by = get_created_by_field("stocktaking_sessions_applied")
    applied_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-count_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "session_number"],
                name="uniq_company_stocktaking_session_number",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "status"]),
        ]

    def __str__(self):
        return f"Stocktaking {self.session_number} ({self.status})"


class StocktakingLine(TenantOwnedModel):
    """Line-level stock count comparison within a session."""

    session = models.ForeignKey(
        StocktakingSession, on_delete=models.CASCADE, related_name="lines"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="stocktaking_lines"
    )
    system_cartons = models.DecimalField(default=ZERO, **QTY_CARTON)
    system_pieces = models.DecimalField(default=ZERO, **QTY_PIECE)
    system_kg = models.DecimalField(default=ZERO, **QTY_KG)
    actual_cartons = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_CARTON)
    actual_pieces = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_PIECE)
    actual_kg = models.DecimalField(default=ZERO, validators=_NON_NEG, **QTY_KG)
    difference_cartons = models.DecimalField(default=ZERO, **QTY_CARTON)
    difference_pieces = models.DecimalField(default=ZERO, **QTY_PIECE)
    difference_kg = models.DecimalField(default=ZERO, **QTY_KG)
    status = models.CharField(
        max_length=12, choices=StocktakingLineStatus.choices,
        default=StocktakingLineStatus.MATCHED,
    )
    unit_cost_per_kg = models.DecimalField(null=True, blank=True, **COST_PER_KG)
    reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    related_movement = models.ForeignKey(
        StockMovement, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stocktaking_line",
    )

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "product"], name="uniq_session_product_line"
            ),
        ]
        indexes = [
            models.Index(fields=["company", "session"]),
        ]

    def __str__(self):
        return f"Line {self.session_id}/{self.product_id} ({self.status})"

    def recompute_difference(self):
        self.difference_cartons = self.actual_cartons - self.system_cartons
        self.difference_pieces = self.actual_pieces - self.system_pieces
        self.difference_kg = self.actual_kg - self.system_kg
        # Status driven primarily by KG (the costing dimension), then cartons.
        diff = self.difference_kg or self.difference_cartons or self.difference_pieces
        if diff > 0:
            self.status = StocktakingLineStatus.INCREASE
        elif diff < 0:
            self.status = StocktakingLineStatus.DECREASE
        else:
            self.status = StocktakingLineStatus.MATCHED


class InventoryValuationSnapshot(TenantOwnedModel):
    """Lightweight point-in-time FIFO valuation snapshot (optional)."""

    snapshot_date = models.DateField()
    total_inventory_value = models.DecimalField(default=ZERO, **MONEY)
    total_available_kg = models.DecimalField(default=ZERO, **QTY_KG)
    generated_by = get_created_by_field("inventory_snapshots_generated")

    class Meta:
        ordering = ["-snapshot_date", "-id"]
        indexes = [
            models.Index(fields=["company", "snapshot_date"]),
        ]

    def __str__(self):
        return f"Valuation {self.snapshot_date}: {self.total_inventory_value}"
