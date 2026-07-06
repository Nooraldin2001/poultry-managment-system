"""Create missing poultry cut products for a tenant (reference data only).

Does not create stock, invoices, or demo transactions.

Usage:
    python manage.py seed_poultry_cut_products --company-subdomain firstview --dry-run
    python manage.py seed_poultry_cut_products --company-subdomain firstview --confirm
"""

from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.enums import PriceType, Unit
from apps.products.models import Product, ProductCategory, ProductType
from apps.products.poultry_cuts import (
    PARTS_CATEGORY_CODE,
    PARTS_CATEGORY_NAME_AR,
    PARTS_CATEGORY_NAME_EN,
    POULTRY_CUT_REFERENCE,
)
from apps.tenants.models import Company


class Command(BaseCommand):
    help = "Create missing poultry cut products (KG-based, inventory tracked) for one tenant."

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List products that would be created (default when --confirm omitted)",
        )
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Create missing cut products",
        )

    def handle(self, *args, **options):
        subdomain = options["company_subdomain"].strip().lower()
        confirm = options["confirm"]
        dry_run = not confirm

        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist as exc:
            raise CommandError(f"No company with subdomain '{subdomain}'.") from exc

        to_create = []
        for sku, name_ar, name_en in POULTRY_CUT_REFERENCE:
            exists = Product.objects.filter(company=company, sku=sku).exists()
            if not exists:
                by_name = Product.objects.filter(company=company, name_ar=name_ar).exists()
                if not by_name:
                    to_create.append((sku, name_ar, name_en))

        self.stdout.write(
            f"Company {company.subdomain}: {len(to_create)} poultry cut product(s) to create"
        )
        for sku, name_ar, name_en in to_create:
            self.stdout.write(f"  + {sku} {name_ar} / {name_en}")

        if not to_create:
            self.stdout.write(self.style.SUCCESS("All reference cuts already exist."))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run — re-run with --confirm to create."))
            return

        with transaction.atomic():
            category, _ = ProductCategory.objects.get_or_create(
                company=company,
                code=PARTS_CATEGORY_CODE,
                defaults={
                    "name_ar": PARTS_CATEGORY_NAME_AR,
                    "name_en": PARTS_CATEGORY_NAME_EN,
                },
            )
            created = 0
            for sku, name_ar, name_en in to_create:
                Product.objects.create(
                    company=company,
                    category=category,
                    name_ar=name_ar,
                    name_en=name_en,
                    sku=sku,
                    product_type=ProductType.CHICKEN_PART,
                    default_unit=Unit.KG,
                    sales_price=Decimal("0.00"),
                    sales_price_type=PriceType.KG,
                    purchase_price=Decimal("0.00"),
                    purchase_price_type=PriceType.KG,
                    track_inventory=True,
                    can_sell=True,
                    can_purchase=True,
                    can_quote=True,
                    minimum_stock_kg=Decimal("0.000"),
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created} poultry cut product(s)."))
