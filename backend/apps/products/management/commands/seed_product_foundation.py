from django.core.management.base import BaseCommand, CommandError

from apps.products.seeders import seed_product_foundation
from apps.tenants.models import Company


class Command(BaseCommand):
    help = "Seed product categories and sample products for a company."

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)

    def handle(self, *args, **options):
        subdomain = options["company_subdomain"]
        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(f"No company with subdomain '{subdomain}'.")
        cats, prods = seed_product_foundation(company)
        label = company.name_en or company.name_ar
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {cats} categories and {prods} products for {label}."
        ))
