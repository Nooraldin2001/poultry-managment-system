"""Remove demo-like records from a single tenant (scoped, pattern-based).

Always dry-run by default. Requires explicit subdomain and confirmation to delete.

Usage:
    python manage.py purge_tenant_demo_data --company-subdomain firstview --dry-run
    python manage.py purge_tenant_demo_data --company-subdomain firstview --confirm-delete-demo-data
"""

import re

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from apps.core.management.commands.purge_demo_data import TENANT_MODELS_IN_ORDER

# Case-insensitive markers for demo / sample / smoke data (not generic business words).
_DEMO_NAME_PATTERNS = re.compile(
    r"(demo|sample|smoke\s*test|fake|test\s*customer|test\s*supplier|prime\s*fresh|"
    r"primefresh|gulf\s*restaurant|al\s*khalij|madina\s*supermarket|emirates\s*kitchen|"
    r"westland|wataniyah|تجريبي|عينة|اختبار)",
    re.IGNORECASE,
)
_DEMO_EMAIL_PATTERNS = re.compile(r"(example\.com|@demo\.|@test\.|smoke\.|\.test$)", re.IGNORECASE)

# Known demo seed customer/supplier names (exact match, case-insensitive).
_KNOWN_DEMO_NAMES = {
    "مطعم الخليج", "gulf restaurant", "سوبر ماركت المدينة", "al madina supermarket",
    "مطبخ الإمارات", "emirates kitchen", "prime fresh meat llc", "prime fresh meat",
    "westland foodstuff", "مزرعة العين للدواجن", "mnm foodstuff", "نقل الإمارات",
    "smoke test customer", "test customer", "demo customer",
}


def _looks_demo_name(value: str | None) -> bool:
    if not value:
        return False
    normalized = value.strip().lower()
    if normalized in {n.lower() for n in _KNOWN_DEMO_NAMES}:
        return True
    return bool(_DEMO_NAME_PATTERNS.search(value))


def _looks_demo_email(value: str | None) -> bool:
    if not value:
        return False
    return bool(_DEMO_EMAIL_PATTERNS.search(value.strip().lower()))


def _is_demo_customer(obj) -> bool:
    return (
        _looks_demo_name(getattr(obj, "name_ar", None))
        or _looks_demo_name(getattr(obj, "name_en", None))
        or _looks_demo_email(getattr(obj, "email", None))
    )


def _is_demo_supplier(obj) -> bool:
    return (
        _looks_demo_name(getattr(obj, "name_ar", None))
        or _looks_demo_name(getattr(obj, "name_en", None))
        or _looks_demo_email(getattr(obj, "email", None))
    )


def _is_demo_product(obj) -> bool:
    sku = (getattr(obj, "sku", None) or "").lower()
    if sku in {"w-900", "sku1", "chk-1000"}:
        return True
    return _looks_demo_name(getattr(obj, "name_ar", None)) or _looks_demo_name(
        getattr(obj, "name_en", None)
    )


class Command(BaseCommand):
    help = (
        "List or delete demo-like tenant records for one company subdomain. "
        "Default is dry-run. Never deletes the company or users."
    )

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List counts only (default when --confirm-delete-demo-data is omitted).",
        )
        parser.add_argument(
            "--confirm-delete-demo-data",
            action="store_true",
            help="Required to delete matched demo-like records.",
        )

    def handle(self, *args, **options):
        from django.apps import apps as django_apps
        from apps.tenants.models import Company

        subdomain = (options["company_subdomain"] or "").strip().lower()
        confirmed = options["confirm_delete_demo_data"]
        dry_run = options["dry_run"] or not confirmed

        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(f"No company with subdomain '{subdomain}'.")

        self.stdout.write(
            f"Tenant: {company.name_en} ({company.subdomain}) [id={company.pk}]"
        )

        Customer = django_apps.get_model("customers", "Customer")
        Supplier = django_apps.get_model("suppliers", "Supplier")
        Product = django_apps.get_model("products", "Product")

        demo_customers = [c for c in Customer.objects.filter(company=company) if _is_demo_customer(c)]
        demo_suppliers = [s for s in Supplier.objects.filter(company=company) if _is_demo_supplier(s)]
        demo_products = [p for p in Product.objects.filter(company=company) if _is_demo_product(p)]

        plan: list[tuple[str, list]] = [
            ("customers.Customer (demo-like)", demo_customers),
            ("suppliers.Supplier (demo-like)", demo_suppliers),
            ("products.Product (demo-like)", demo_products),
        ]

        # Transactional rows tied to demo masters will cascade or be counted via FK.
        self.stdout.write("Demo-like master records:")
        total = 0
        for label, items in plan:
            n = len(items)
            total += n
            if n:
                self.stdout.write(f"  - {label}: {n}")
                for item in items[:10]:
                    name = getattr(item, "name_en", None) or getattr(item, "name_ar", None) or item.pk
                    self.stdout.write(f"      id={item.pk} name={name}")
                if n > 10:
                    self.stdout.write(f"      ... and {n - 10} more")

        if total == 0:
            self.stdout.write(self.style.SUCCESS("No demo-like master records detected."))
            return

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run: {total} demo-like master record(s) would be targeted. "
                    "Related transactional rows may cascade. Nothing deleted."
                )
            )
            return

        with transaction.atomic():
            deleted_total = 0
            for label, items in plan:
                for item in items:
                    pk = item.pk
                    item.delete()
                    deleted_total += 1
                    self.stdout.write(f"Deleted {label} id={pk}")

        self.stdout.write(
            self.style.SUCCESS(f"Deleted {deleted_total} demo-like master record(s).")
        )
