from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.enums import PriceType, Unit
from apps.core.models import TenantOwnedModel, get_created_by_field

from . import pricing


class ProductType(models.TextChoices):
    FIXED_WEIGHT = "fixed_weight", "Fixed Weight"
    MOVING_WEIGHT = "moving_weight", "Moving/Custom Weight"
    BY_PRODUCT = "by_product", "By-product"
    CHICKEN_PART = "chicken_part", "Chicken Part"
    SERVICE = "service", "Service"
    OTHER = "other", "Other"


MOVING_WEIGHT_MIN_GRAMS = 1550


class ProductCategory(TenantOwnedModel):
    name_ar = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255, blank=True)
    code = models.CharField(max_length=32)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name_ar"]
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="uniq_company_productcategory_code"),
            models.UniqueConstraint(fields=["company", "name_ar"], name="uniq_company_productcategory_name_ar"),
        ]
        verbose_name_plural = "product categories"

    def __str__(self):
        return f"{self.name_ar} ({self.code})"


class Product(TenantOwnedModel):
    category = models.ForeignKey(
        ProductCategory, on_delete=models.PROTECT, related_name="products"
    )
    name_ar = models.CharField(max_length=255)
    name_en = models.CharField(max_length=255, blank=True)
    sku = models.CharField(max_length=64)
    product_type = models.CharField(max_length=20, choices=ProductType.choices)

    weight_grams = models.PositiveIntegerField(null=True, blank=True)
    default_pieces_per_carton = models.PositiveIntegerField(null=True, blank=True)
    default_unit = models.CharField(
        max_length=10, choices=Unit.choices, default=Unit.CARTON
    )

    sales_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    sales_price_type = models.CharField(
        max_length=10, choices=PriceType.choices, default=PriceType.KG
    )
    purchase_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    purchase_price_type = models.CharField(
        max_length=10, choices=PriceType.choices, default=PriceType.KG
    )

    minimum_stock_cartons = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    minimum_stock_pieces = models.PositiveIntegerField(default=0)
    minimum_stock_kg = models.DecimalField(
        max_digits=12, decimal_places=3, default=Decimal("0.000"),
        validators=[MinValueValidator(Decimal("0.000"))],
    )

    track_inventory = models.BooleanField(default=True)
    vat_taxable = models.BooleanField(default=True)
    allow_customer_special_price = models.BooleanField(default=True)
    allow_supplier_special_price = models.BooleanField(default=True)
    allow_free_product = models.BooleanField(default=True)
    can_sell = models.BooleanField(default=True)
    can_purchase = models.BooleanField(default=True)
    can_quote = models.BooleanField(default=True)

    is_active = models.BooleanField(default=True)
    disabled_at = models.DateTimeField(null=True, blank=True)
    disabled_by = get_created_by_field("products_disabled")
    disable_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["name_ar"]
        constraints = [
            models.UniqueConstraint(fields=["company", "sku"], name="uniq_company_product_sku"),
        ]
        indexes = [
            models.Index(fields=["company", "product_type"]),
            models.Index(fields=["company", "is_active"]),
            models.Index(fields=["company", "category"]),
        ]

    def __str__(self):
        return f"{self.name_ar} [{self.sku}]"

    # --- Validation -------------------------------------------------------
    def clean(self):
        errors = {}
        if not self.name_ar:
            errors["name_ar"] = "Arabic name is required."
        if not self.sku:
            errors["sku"] = "SKU is required."

        if self.product_type == ProductType.FIXED_WEIGHT:
            if not self.weight_grams or self.weight_grams <= 0:
                errors["weight_grams"] = "Fixed-weight products require a positive weight (grams)."
            if not self.default_pieces_per_carton or self.default_pieces_per_carton <= 0:
                errors["default_pieces_per_carton"] = (
                    "Fixed-weight products require positive default pieces per carton."
                )
        if self.product_type == ProductType.MOVING_WEIGHT and self.weight_grams:
            if self.weight_grams < MOVING_WEIGHT_MIN_GRAMS:
                errors["weight_grams"] = (
                    f"Moving-weight products with a default weight should be "
                    f"{MOVING_WEIGHT_MIN_GRAMS}g or above."
                )
        if self.sales_price is not None and self.sales_price < 0:
            errors["sales_price"] = "Price cannot be negative."
        if self.purchase_price is not None and self.purchase_price < 0:
            errors["purchase_price"] = "Price cannot be negative."
        if errors:
            raise ValidationError(errors)

    # --- Computed helpers -------------------------------------------------
    @property
    def carton_weight_kg(self):
        return pricing.carton_weight_kg(self.weight_grams, self.default_pieces_per_carton)

    def calculate_pieces(self, cartons):
        return pricing.calculate_pieces(cartons, self.default_pieces_per_carton)

    def calculate_kg(self, cartons, pieces_per_carton=None, weight_grams=None):
        return pricing.calculate_kg(
            cartons,
            pieces_per_carton or self.default_pieces_per_carton,
            weight_grams or self.weight_grams,
        )

    def calculate_line_amount(self, quantity, price=None, price_type=None):
        return pricing.calculate_line_amount(
            quantity,
            self.sales_price if price is None else price,
            price_type or self.sales_price_type,
        )
