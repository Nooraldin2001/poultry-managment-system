"""Reusable customer seed helpers (idempotent)."""

from decimal import Decimal

from . import services
from .models import Customer, CustomerCategory, CustomerType, OpeningBalanceType

CATEGORIES = [
    ("مطعم", "REST", "Restaurant"),
    ("سوبر ماركت", "SUPER", "Supermarket"),
    ("ملحمة", "BUTCH", "Butchery"),
    ("فندق", "HOTEL", "Hotel"),
    ("مطبخ", "KITCH", "Kitchen"),
    ("عميل كاش", "CASH", "Cash Customer"),
    ("عميل آجل", "CREDIT", "Credit Customer"),
    ("أخرى", "OTHER", "Other"),
]

# (name_ar, name_en, phone, category_code, customer_type, credit_limit,
#  opening_balance, opening_balance_type)
CUSTOMERS = [
    ("مطعم الخليج", "Gulf Restaurant", "+971500000001", "REST", CustomerType.CREDIT, "5000.00", "1200.00", OpeningBalanceType.CUSTOMER_OWES_US),
    ("سوبر ماركت المدينة", "Al Madina Supermarket", "+971500000002", "SUPER", CustomerType.CREDIT, "8000.00", "0.00", OpeningBalanceType.ZERO),
    ("مطبخ الإمارات", "Emirates Kitchen", "+971500000003", "KITCH", CustomerType.CASH, "0.00", "0.00", OpeningBalanceType.ZERO),
    ("Prime Fresh Meat LLC", "Prime Fresh Meat LLC", "+971500000004", "CREDIT", CustomerType.CREDIT, "15000.00", "500.00", OpeningBalanceType.WE_OWE_CUSTOMER),
]


def seed_categories(company):
    created = 0
    for idx, (name_ar, code, name_en) in enumerate(CATEGORIES):
        _, was_created = CustomerCategory.objects.update_or_create(
            company=company, code=code,
            defaults={"name_ar": name_ar, "name_en": name_en, "sort_order": idx},
        )
        created += int(was_created)
    return created


def seed_customers(company):
    cats = {c.code: c for c in CustomerCategory.objects.filter(company=company)}
    created = 0
    for (name_ar, name_en, phone, cat_code, ctype, credit_limit, ob, ob_type) in CUSTOMERS:
        if Customer.objects.filter(company=company, name_ar=name_ar).exists():
            continue
        services.create_customer_with_opening_balance(
            company=company,
            category=cats.get(cat_code) or cats.get("OTHER"),
            name_ar=name_ar, name_en=name_en, phone=phone,
            customer_type=ctype, credit_limit=Decimal(credit_limit),
            opening_balance=Decimal(ob), opening_balance_type=ob_type,
        )
        created += 1
    return created


def seed_customer_demo(company):
    return seed_categories(company), seed_customers(company)
