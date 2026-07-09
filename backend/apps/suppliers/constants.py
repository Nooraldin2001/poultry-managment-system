"""Well-known supplier category codes for service vendors (tenant-scoped categories)."""

CATEGORY_POULTRY = "poultry"
CATEGORY_SLAUGHTERHOUSE = "slaughterhouse"
CATEGORY_TRANSPORT = "transport"
CATEGORY_FOOD_COMPANY = "food_company"
CATEGORY_OTHER = "other"

SERVICE_CATEGORY_CODES = frozenset({
    CATEGORY_SLAUGHTERHOUSE,
    CATEGORY_TRANSPORT,
})
