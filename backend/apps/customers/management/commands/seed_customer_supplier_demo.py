from django.core.management.base import BaseCommand, CommandError

from apps.customers.seeders import seed_customer_demo
from apps.suppliers.seeders import seed_supplier_demo
from apps.tenants.models import Company


class Command(BaseCommand):
    help = "Seed demo customer + supplier categories and sample records for a company."

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)

    def handle(self, *args, **options):
        subdomain = options["company_subdomain"]
        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(f"No company with subdomain '{subdomain}'.")
        c_cats, c_count = seed_customer_demo(company)
        s_cats, s_count = seed_supplier_demo(company)
        self.stdout.write(self.style.SUCCESS(
            f"Customers: {c_cats} categories, {c_count} records. "
            f"Suppliers: {s_cats} categories, {s_count} records."
        ))
