"""Pure purchase calculation helpers (no DB access).

Two distinct money concepts that must never be silently mixed:

* **Supplier payable** = subtotal + VAT − payable-reducing adjustments.
* **Inventory cost basis** = subtotal + `increase_inventory_cost` adjustments.

Both derive from line subtotals but diverge once adjustments apply.
"""

from decimal import Decimal

from apps.core.enums import PriceType

ZERO = Decimal("0")
MONEY_Q = Decimal("0.01")
COST_Q = Decimal("0.0001")


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value if value is not None else 0))


def line_subtotal(*, price_type, unit_price, quantity_cartons=ZERO,
                  quantity_pieces=ZERO, quantity_kg=ZERO) -> Decimal:
    """Line subtotal based on the unit the price is quoted in.

    * kg     → quantity_kg × unit_price
    * piece  → quantity_pieces × unit_price
    * carton → quantity_cartons × unit_price
    * tray   → simplified to a pieces basis (no dedicated tray quantity yet;
               documented limitation — tray purchases use the pieces column).
    """
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
    """vat_amount = taxable_amount × vat_rate / 100."""
    return (_d(taxable_amount) * _d(vat_rate) / Decimal("100")).quantize(MONEY_Q)


def unit_cost_per_kg(allocated_cost, quantity_kg) -> Decimal:
    """Allocated inventory cost ÷ KG. Returns 0 when KG is not meaningful."""
    quantity_kg = _d(quantity_kg)
    if quantity_kg <= 0:
        return ZERO
    return (_d(allocated_cost) / quantity_kg).quantize(COST_Q)


def allocate_inventory_cost(line_subtotals, extra_inventory_cost) -> list:
    """Spread `extra_inventory_cost` across lines proportionally by subtotal.

    Returns a list of allocated **total** costs (subtotal + share) aligned with
    ``line_subtotals``. If the subtotals sum to zero, the extra cost is split
    evenly across lines.
    """
    subtotals = [_d(s) for s in line_subtotals]
    extra = _d(extra_inventory_cost)
    base_total = sum(subtotals, ZERO)
    allocations = []
    if base_total > 0:
        for s in subtotals:
            share = (extra * (s / base_total)).quantize(MONEY_Q)
            allocations.append(s + share)
    elif subtotals:
        even = (extra / Decimal(len(subtotals))).quantize(MONEY_Q)
        allocations = [s + even for s in subtotals]
    return allocations
