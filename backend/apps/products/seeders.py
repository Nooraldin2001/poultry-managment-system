"""Reusable product seed helpers (idempotent)."""

from decimal import Decimal

from apps.core.enums import PriceType, Unit

from .models import Product, ProductCategory, ProductType

CATEGORIES = [
    ("دجاج كامل", "WHOLE", "Whole Chicken"),
    ("أوزان ثابتة", "FIXED", "Fixed Weight"),
    ("أوزان متحركة", "MOVING", "Moving Weight"),
    ("أجزاء الدجاج", "PARTS", "Chicken Parts"),
    ("منتجات جانبية", "BYPROD", "By-products"),
    ("خدمات تعبئة / تغليف", "PACK", "Packing Services"),
    ("لحوم أخرى", "MEAT", "Other Meats"),
    ("أخرى", "OTHER", "Other"),
]

# (sku, name_ar, name_en, category_code, type, weight_grams, pieces_per_carton,
#  default_unit, sales_price, sales_price_type)
PRODUCTS = [
    ("P900", "دجاج 900 جرام", "900 GRAM", "FIXED", ProductType.FIXED_WEIGHT, 900, 10, Unit.CARTON, "95.00", PriceType.CARTON),
    ("P1000", "دجاج 1000 جرام", "1000 GRAM", "FIXED", ProductType.FIXED_WEIGHT, 1000, 10, Unit.CARTON, "100.00", PriceType.CARTON),
    ("P1100", "دجاج 1100 جرام", "1100 GRAM", "FIXED", ProductType.FIXED_WEIGHT, 1100, 10, Unit.CARTON, "108.00", PriceType.CARTON),
    ("P1200", "دجاج 1200 جرام", "1200 GRAM", "FIXED", ProductType.FIXED_WEIGHT, 1200, 9, Unit.CARTON, "115.00", PriceType.CARTON),
    ("P1300", "دجاج 1300 جرام", "1300 GRAM", "FIXED", ProductType.FIXED_WEIGHT, 1300, 9, Unit.CARTON, "122.00", PriceType.CARTON),
    ("P1600M", "دجاج 1600 جرام متحرك", "1600 GRAM moving weight", "MOVING", ProductType.MOVING_WEIGHT, 1600, None, Unit.KG, "9.50", PriceType.KG),
    ("LIV500", "كبد 500 جرام", "Liver 500G", "BYPROD", ProductType.BY_PRODUCT, 500, 20, Unit.CARTON, "60.00", PriceType.CARTON),
    ("GIZ500", "قوانص 500 جرام", "Gizzard 500G", "BYPROD", ProductType.BY_PRODUCT, 500, 20, Unit.CARTON, "55.00", PriceType.CARTON),
    ("HRT500", "قلوب 500 جرام", "Heart 500G", "BYPROD", ProductType.BY_PRODUCT, 500, 20, Unit.CARTON, "58.00", PriceType.CARTON),
    ("WINGS", "أجنحة", "Wings", "PARTS", ProductType.CHICKEN_PART, None, None, Unit.KG, "14.00", PriceType.KG),
    ("BONE", "عظام", "Bone", "BYPROD", ProductType.BY_PRODUCT, None, None, Unit.KG, "3.50", PriceType.KG),
]


def seed_categories(company):
    created = 0
    for idx, (name_ar, code, name_en) in enumerate(CATEGORIES):
        _, was_created = ProductCategory.objects.update_or_create(
            company=company, code=code,
            defaults={"name_ar": name_ar, "name_en": name_en, "sort_order": idx},
        )
        created += int(was_created)
    return created


def seed_products(company):
    cats = {c.code: c for c in ProductCategory.objects.filter(company=company)}
    created = 0
    for (sku, name_ar, name_en, cat_code, ptype, grams, ppc, unit, price, ptype_price) in PRODUCTS:
        category = cats.get(cat_code) or cats.get("OTHER")
        _, was_created = Product.objects.update_or_create(
            company=company, sku=sku,
            defaults={
                "category": category,
                "name_ar": name_ar,
                "name_en": name_en,
                "product_type": ptype,
                "weight_grams": grams,
                "default_pieces_per_carton": ppc,
                "default_unit": unit,
                "sales_price": Decimal(price),
                "sales_price_type": ptype_price,
            },
        )
        created += int(was_created)
    return created


def seed_product_foundation(company):
    cats = seed_categories(company)
    prods = seed_products(company)
    return cats, prods
