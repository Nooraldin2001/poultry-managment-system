"""Delete all operational data for one tenant while preserving company, users, subscription.

DANGEROUS — requires explicit confirmation. Default is dry-run.

Usage:
    python manage.py reset_tenant_operational_data --company-subdomain firstview --dry-run
    python manage.py reset_tenant_operational_data --company-subdomain firstview --confirm-reset-empty-tenant
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.management.commands.purge_demo_data import TENANT_MODELS_IN_ORDER


class Command(BaseCommand):
    help = (
        "Delete operational tenant data for one company. Preserves Company, users, "
        "subscription, permissions, and company settings. Requires confirmation."
    )

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List counts only (default when confirmation flag is omitted).",
        )
        parser.add_argument(
            "--confirm-reset-empty-tenant",
            action="store_true",
            help="Required to delete operational data.",
        )

    def handle(self, *args, **options):
        from django.apps import apps as django_apps
        from apps.tenants.models import Company

        subdomain = (options["company_subdomain"] or "").strip().lower()
        confirmed = options["confirm_reset_empty_tenant"]
        dry_run = options["dry_run"] or not confirmed

        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(f"No company with subdomain '{subdomain}'.")

        self.stderr.write(self.style.WARNING(
            "WARNING: reset_tenant_operational_data deletes transactional data for "
            f"'{subdomain}'. Company and users are preserved."
        ))

        plan = []
        for app_label, model_name in TENANT_MODELS_IN_ORDER:
            model = django_apps.get_model(app_label, model_name)
            qs = model.objects.filter(company=company)
            plan.append((f"{app_label}.{model_name}", qs))

        AuditLog = django_apps.get_model("audit", "AuditLog")
        audit_qs = AuditLog.objects.filter(company=company)

        self.stdout.write(
            f"Tenant: {company.name_en} ({company.subdomain}) [id={company.pk}]"
        )
        self.stdout.write("Operational rows to delete:")
        total = 0
        for label, qs in plan:
            n = qs.count()
            total += n
            if n:
                self.stdout.write(f"  - {label}: {n}")
        n_audit = audit_qs.count()
        if n_audit:
            self.stdout.write(f"  - audit.AuditLog: {n_audit}")
            total += n_audit

        self.stdout.write(f"Total operational rows: {total}")
        self.stdout.write("Preserved: tenants.Company, accounts.User, subscription, settings")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run: nothing deleted."))
            return

        with transaction.atomic():
            for label, qs in plan:
                deleted, _ = qs.delete()
                if deleted:
                    self.stdout.write(f"Deleted {label}: {deleted}")
            ad, _ = audit_qs.delete()
            if ad:
                self.stdout.write(f"Deleted audit.AuditLog: {ad}")

        self.stdout.write(self.style.SUCCESS(
            f"Operational data cleared for tenant '{subdomain}'. Company and users preserved."
        ))
