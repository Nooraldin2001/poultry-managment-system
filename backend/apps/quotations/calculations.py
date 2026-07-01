"""Pure quotation calculation helpers (no DB access)."""

from decimal import Decimal

from apps.core.enums import PriceType

ZERO = Decimal("0")
MONEY_Q = Decimal("0.01")


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value if value is not None else 0))


def line_subtotal(*, price_type, unit_price, quantity_cartons=ZERO,
                  quantity_pieces=ZERO, quantity_kg=ZERO, is_free=False) -> Decimal:
    if is_free:
        return ZERO
    unit_price = _d(unit_price)
    if price_type == PriceType.KG:
        qty = _d(quantity_kg)
    elif price_type == PriceType.PIECE:
        qty = _d(quantity_pieces)
    elif price_type == PriceType.CARTON:
        qty = _d(quantity_cartons)
    elif price_type == PriceType.TRAY:
        qty = _d(quantity_pieces)  # simplified tray basis
    else:
        qty = ZERO
    return (qty * unit_price).quantize(MONEY_Q)


def vat_amount(taxable_amount, vat_rate) -> Decimal:
    return (_d(taxable_amount) * _d(vat_rate) / Decimal("100")).quantize(MONEY_Q)
