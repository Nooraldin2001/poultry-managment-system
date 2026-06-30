"""Pure pricing/quantity helper functions (no DB access).

These are the foundation utilities that later sales/purchase line calculations
will reuse. See docs/backend/BUSINESS_RULES.md formulas.
"""

from decimal import Decimal

from apps.core.enums import PriceType

THOUSAND = Decimal("1000")


def _d(value) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value or 0))


def calculate_pieces(cartons, pieces_per_carton) -> int:
    """pieces = cartons × pieces_per_carton."""
    return int(cartons or 0) * int(pieces_per_carton or 0)


def calculate_kg(cartons, pieces_per_carton, weight_grams) -> Decimal:
    """kg = pieces × weight_grams ÷ 1000 (for fixed-weight products)."""
    pieces = calculate_pieces(cartons, pieces_per_carton)
    return (_d(pieces) * _d(weight_grams)) / THOUSAND


def carton_weight_kg(weight_grams, pieces_per_carton):
    """Weight of one full carton in KG, or None if inputs are missing."""
    if not weight_grams or not pieces_per_carton:
        return None
    return (_d(weight_grams) * _d(pieces_per_carton)) / THOUSAND


def calculate_line_amount(quantity, price, price_type) -> Decimal:
    """Foundation line-amount calc.

    ``quantity`` is interpreted in the unit implied by ``price_type``:
    kg -> kg, piece -> pieces, carton -> cartons, tray -> trays. For this
    foundation phase the amount is simply ``quantity × price`` since the unit of
    quantity matches the price unit; later sales/purchase code converts cartons/
    pieces/kg into the correct quantity before calling this.
    """
    if price_type not in PriceType.values:
        raise ValueError(f"Unknown price_type: {price_type}")
    return (_d(quantity) * _d(price)).quantize(Decimal("0.01"))
