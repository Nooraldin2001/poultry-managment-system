"""Poultry cut / KG-primary product helpers.

Product types (no migration):
* ``fixed_weight`` — carton-based whole birds (pieces per carton + weight grams).
* ``moving_weight`` — variable-weight whole birds; purchased/sold by KG.
* ``chicken_part`` — poultry cuts (liver, breast, wings, …); KG-primary.
* ``by_product`` — organ meats when sold by KG; may also have carton specs for legacy SKUs.
"""

from .models import Product, ProductType

# Reference data for optional tenant seed command (not auto-created).
POULTRY_CUT_REFERENCE = (
    ("CUT-LIVER", "كبده", "Liver"),
    ("CUT-GIZZARD", "قوانص", "Gizzards"),
    ("CUT-HEART", "قلوب", "Hearts"),
    ("CUT-BREAST", "صدور", "Breast"),
    ("CUT-THIGH", "افخاذ", "Thighs"),
    ("CUT-WING", "اجنحة", "Wings"),
    ("CUT-BONE", "عظم", "Bone"),
)

PARTS_CATEGORY_CODE = "PARTS"
PARTS_CATEGORY_NAME_AR = "مقطعات"
PARTS_CATEGORY_NAME_EN = "Poultry Cuts"


def is_carton_based_product(product: Product) -> bool:
    """Whole-bird / fixed-weight products purchased by cartons."""
    return product.product_type == ProductType.FIXED_WEIGHT


def is_kg_primary_product(product: Product) -> bool:
    """Products purchased primarily by KG (cuts, moving weight, loose by-products)."""
    if product.product_type in (ProductType.CHICKEN_PART, ProductType.MOVING_WEIGHT):
        return True
    if product.product_type == ProductType.BY_PRODUCT:
        return not (
            product.weight_grams
            and product.weight_grams > 0
            and product.default_pieces_per_carton
            and product.default_pieces_per_carton > 0
        )
    return False


def validate_purchase_line_quantities(
    *,
    product: Product,
    quantity_cartons,
    quantity_pieces,
    quantity_kg,
) -> dict[str, str]:
    """Return field errors for purchase line quantities (empty dict = OK)."""
    from decimal import Decimal

    ZERO = Decimal("0")
    cartons = quantity_cartons if quantity_cartons is not None else ZERO
    pieces = quantity_pieces if quantity_pieces is not None else ZERO
    kg = quantity_kg if quantity_kg is not None else ZERO

    if not product.track_inventory:
        return {}

    if is_kg_primary_product(product):
        if kg <= 0:
            return {
                "quantity_kg": (
                    "KG must be greater than zero for poultry cuts and KG-based products."
                )
            }
        return {}

    if is_carton_based_product(product):
        if cartons <= 0 and pieces <= 0 and kg <= 0:
            return {"quantity": "Cartons, pieces, or KG are required for this product."}
        return {}

    total = cartons + pieces + kg
    if total <= 0:
        return {"quantity": "Stock-tracked product lines require a quantity."}
    return {}
