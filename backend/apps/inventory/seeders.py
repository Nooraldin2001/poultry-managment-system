"""Reusable inventory demo seed helpers (idempotent).

Initializes opening stock for the sample products created by
``seed_product_foundation``. Creates opening-inventory FIFO layers + movements
only; never purchases or sales. Safe to run multiple times.
"""

from decimal import Decimal

from apps.products.models import Product

from . import services
from .models import MovementType, StockMovement, StockSourceType

# (sku, cartons, pieces, kg, unit_cost_per_kg)
OPENING_STOCK = [
    ("P900", "34", "340", "306", "12.00"),
    ("P1000", "8", "80", "80", "12.50"),
    ("P1100", "24", "240", "264", "12.25"),
    ("P1200", "0", "0", "0", "0.00"),
    ("LIV500", "0", "0", "13", "2.50"),
    ("GIZ500", "0", "0", "5", "3.00"),
]


def seed_inventory_demo(company, user=None) -> int:
    """Seed opening stock for sample products. Returns number of products seeded."""
    seeded = 0
    for sku, cartons, pieces, kg, cost in OPENING_STOCK:
        product = Product.objects.filter(company=company, sku=sku).first()
        if product is None or not product.track_inventory:
            continue

        cartons, pieces, kg = Decimal(cartons), Decimal(pieces), Decimal(kg)
        if cartons <= 0 and pieces <= 0 and kg <= 0:
            # e.g. 1200 GRAM: zero stock, no FIFO layer needed.
            services.get_or_create_balance(company, product)
            continue

        # Idempotent: skip if an opening-inventory movement already exists.
        if StockMovement.objects.filter(
            company=company, product=product,
            movement_type=MovementType.OPENING_INVENTORY,
        ).exists():
            continue

        services.add_stock(
            company=company, product=product,
            cartons=cartons, pieces=pieces, kg=kg,
            unit_cost_per_kg=Decimal(cost),
            source_type=StockSourceType.OPENING_INVENTORY,
            reason="Initial demo opening stock", user=user,
            source_reference="DEMO-OPENING",
        )
        seeded += 1
    return seeded
