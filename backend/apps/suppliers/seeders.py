"""Reusable supplier seed helpers (idempotent)."""

from decimal import Decimal

from apps.core.enums import PaymentMethod

from . import services
from .models import OpeningBalanceType, Supplier, SupplierCategory, SupplierType

CATEGORIES = [
    ("مزرعة دواجن", "FARM", "Poultry Farm"),
    ("مسلخ", "SLAUGHTER", "Slaughterhouse"),
    ("شركة مواد غذائية", "FOOD", "Foodstuff Company"),
    ("شركة نقل", "TRANSPORT", "Transport Company"),
    ("مورد كاش", "CASH", "Cash Supplier"),
    ("مورد آجل", "CREDIT", "Credit Supplier"),
    ("أخرى", "OTHER", "Other"),
]

# (name_ar, name_en, phone, category_code, supplier_type, payment_method,
#  opening_balance, opening_balance_type)
SUPPLIERS = [
    ("WESTLAND FOODSTUFF TRADING LLC", "WESTLAND FOODSTUFF TRADING LLC", "+971600000001", "FOOD", SupplierType.CREDIT, PaymentMethod.BANK_TRANSFER, "3000.00", OpeningBalanceType.WE_OWE_SUPPLIER),
    ("MNM Foodstuff Trading LLC", "MNM Foodstuff Trading LLC", "+971600000002", "FOOD", SupplierType.CREDIT, PaymentMethod.BANK_TRANSFER, "0.00", OpeningBalanceType.ZERO),
    ("مزرعة العين للدواجن", "Al Ain Poultry Farm", "+971600000003", "FARM", SupplierType.CREDIT, PaymentMethod.CHEQUE, "1500.00", OpeningBalanceType.WE_OWE_SUPPLIER),
    ("نقل الإمارات", "Emirates Transport", "+971600000004", "TRANSPORT", SupplierType.CASH, PaymentMethod.CASH, "0.00", OpeningBalanceType.ZERO),
]


def seed_categories(company):
    created = 0
    for idx, (name_ar, code, name_en) in enumerate(CATEGORIES):
        _, was_created = SupplierCategory.objects.update_or_create(
            company=company, code=code,
            defaults={"name_ar": name_ar, "name_en": name_en, "sort_order": idx},
        )
        created += int(was_created)
    return created


def seed_suppliers(company):
    cats = {c.code: c for c in SupplierCategory.objects.filter(company=company)}
    created = 0
    for (name_ar, name_en, phone, cat_code, stype, pmethod, ob, ob_type) in SUPPLIERS:
        if Supplier.objects.filter(company=company, name_ar=name_ar).exists():
            continue
        services.create_supplier_with_opening_balance(
            company=company,
            category=cats.get(cat_code) or cats.get("OTHER"),
            name_ar=name_ar, name_en=name_en, phone=phone,
            supplier_type=stype, default_payment_method=pmethod,
            opening_balance=Decimal(ob), opening_balance_type=ob_type,
        )
        created += 1
    return created


def seed_supplier_demo(company):
    return seed_categories(company), seed_suppliers(company)
