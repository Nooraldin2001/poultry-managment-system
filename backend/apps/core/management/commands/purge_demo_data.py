"""Safely remove demo/staging data for a single demo tenant.

This deletes ONLY a known demo company and all of its tenant-scoped data. It
NEVER touches reference/seed data shared by all tenants (Plan, PermissionCode,
RolePermissionDefault) and refuses to run against a non-demo subdomain unless
explicitly overridden.

Usage (always dry-run first):

    python manage.py purge_demo_data --company-subdomain primefresh --dry-run
    python manage.py purge_demo_data --company-subdomain primefresh --confirm-delete-demo-data

Safety:
    * Refuses to delete anything without ``--confirm-delete-demo-data``.
    * ``--dry-run`` lists what would be deleted and deletes nothing.
    * Refuses unknown companies and non-demo subdomains (unless
      ``--allow-nonstandard-subdomain`` is given for an existing company).
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

# Subdomains created by the demo seed commands. Anything else is treated as a
# potential REAL tenant and refused by default.
KNOWN_DEMO_SUBDOMAINS = {"primefresh", "demo"}

# Tenant-owned models in safe deletion order: transactional/child rows first,
# masters (products / customers / suppliers / categories) last, so PROTECT FKs
# between tenant models never block the delete.
TENANT_MODELS_IN_ORDER = [
    ("tax", "TaxWarning"),
    ("tax", "TaxAdjustment"),
    ("tax", "TaxPeriod"),
    ("expenses", "ExpenseStatusHistory"),
    ("expenses", "ExpenseAttachment"),
    ("expenses", "Expense"),
    ("expenses", "RecurringExpense"),
    ("expenses", "ExpenseCategory"),
    ("quotations", "QuotationStatusHistory"),
    ("quotations", "QuotationLine"),
    ("quotations", "Quotation"),
    ("payments", "PaymentStatusHistory"),
    ("payments", "PaymentAllocation"),
    ("payments", "PaymentMovement"),
    ("sales", "SalesInventoryAllocation"),
    ("sales", "SalesStatusHistory"),
    ("sales", "SalesInvoiceAdjustment"),
    ("sales", "SalesInvoiceLine"),
    ("sales", "SalesInvoice"),
    ("purchases", "PurchaseStatusHistory"),
    ("purchases", "PurchaseAttachment"),
    ("purchases", "PurchaseAdjustment"),
    ("purchases", "PurchaseInvoiceLine"),
    ("purchases", "PurchaseInvoice"),
    ("inventory", "StockMovement"),
    ("inventory", "StocktakingLine"),
    ("inventory", "StocktakingSession"),
    ("inventory", "StockAdjustment"),
    ("inventory", "InventoryValuationSnapshot"),
    ("inventory", "FIFOStockLayer"),
    ("inventory", "InventoryBalance"),
    ("suppliers", "SupplierAgreement"),
    ("suppliers", "SupplierSpecialPrice"),
    ("suppliers", "SupplierLedgerEntry"),
    ("suppliers", "Supplier"),
    ("suppliers", "SupplierCategory"),
    ("customers", "CustomerCreditLimitChange"),
    ("customers", "CustomerFreeProductAgreement"),
    ("customers", "CustomerSpecialPrice"),
    ("customers", "CustomerLedgerEntry"),
    ("customers", "Customer"),
    ("customers", "CustomerCategory"),
    ("products", "Product"),
    ("products", "ProductCategory"),
]

# Reference/seed data that must NEVER be deleted by this command.
PROTECTED_REFERENCE_MODELS = [
    ("subscriptions", "Plan"),
    ("permissions", "PermissionCode"),
    ("permissions", "RolePermissionDefault"),
]


class Command(BaseCommand):
    help = (
        "Delete a known demo tenant and all its tenant-scoped data. Never deletes "
        "reference seeds (Plan/PermissionCode/RolePermissionDefault). Requires "
        "--confirm-delete-demo-data; supports --dry-run."
    )

    def add_arguments(self, parser):
        parser.add_argument("--company-subdomain", required=True)
        parser.add_argument(
            "--confirm-delete-demo-data", action="store_true",
            help="Required to actually delete. Without it the command refuses.",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="List what would be deleted and delete nothing.",
        )
        parser.add_argument(
            "--allow-nonstandard-subdomain", action="store_true",
            help="Allow purging an existing company whose subdomain is not a known "
                 "demo subdomain. Use with extreme care.",
        )

    def handle(self, *args, **options):
        from django.apps import apps as django_apps
        from apps.tenants.models import Company

        subdomain = (options["company_subdomain"] or "").strip().lower()
        dry_run = options["dry_run"]
        confirmed = options["confirm_delete_demo_data"]
        allow_nonstandard = options["allow_nonstandard_subdomain"]

        self.stderr.write(self.style.WARNING(
            "WARNING: purge_demo_data permanently DELETES a demo tenant and all of "
            "its data. This is destructive and irreversible."
        ))

        # --- Resolve + validate target company --------------------------------
        try:
            company = Company.objects.get(subdomain=subdomain)
        except Company.DoesNotExist:
            raise CommandError(
                f"No company with subdomain '{subdomain}'. Refusing to do anything."
            )

        if subdomain not in KNOWN_DEMO_SUBDOMAINS and not allow_nonstandard:
            raise CommandError(
                f"'{subdomain}' is not a known demo subdomain "
                f"({sorted(KNOWN_DEMO_SUBDOMAINS)}). Refusing to delete a possibly "
                "real tenant. Re-run with --allow-nonstandard-subdomain only if you "
                "are absolutely certain this is demo/staging data."
            )

        # --- Build the deletion plan (counts) ---------------------------------
        plan = []  # list of (label, queryset)
        for app_label, model_name in TENANT_MODELS_IN_ORDER:
            model = django_apps.get_model(app_label, model_name)
            qs = model.objects.filter(company=company)
            plan.append((f"{app_label}.{model_name}", qs))

        AuditLog = django_apps.get_model("audit", "AuditLog")
        User = django_apps.get_model("accounts", "User")
        audit_qs = AuditLog.objects.filter(company=company)
        users_qs = User.objects.filter(company=company)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Demo tenant: {company.name_en} ({company.subdomain}) [id={company.pk}]"
        ))
        self.stdout.write("Will delete the following (counts):")
        total = 0
        for label, qs in plan:
            n = qs.count()
            total += n
            if n:
                self.stdout.write(f"  - {label}: {n}")
        n_audit = audit_qs.count()
        n_users = users_qs.count()
        total += n_audit + n_users + 1  # +1 for the company row
        self.stdout.write(f"  - audit.AuditLog: {n_audit}")
        self.stdout.write(f"  - accounts.User: {n_users}")
        self.stdout.write("  - subscriptions.CompanySubscription + payments + "
                          "company_settings.* : via cascade on company delete")
        self.stdout.write(f"  - tenants.Company: 1")
        self.stdout.write(f"Total rows directly counted: {total}")

        # Reassure that reference seeds are untouched.
        self.stdout.write(self.style.HTTP_INFO(
            "Reference seeds NOT touched: "
            + ", ".join(f"{a}.{m}" for a, m in PROTECTED_REFERENCE_MODELS)
        ))

        # --- Dry run stops here -----------------------------------------------
        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run: nothing was deleted."))
            return

        if not confirmed:
            raise CommandError(
                "Refusing to delete without --confirm-delete-demo-data. "
                "Run with --dry-run first to preview, then re-run with "
                "--confirm-delete-demo-data to actually delete."
            )

        # --- Delete --------------------------------------------------------
        with transaction.atomic():
            for label, qs in plan:
                deleted, _ = qs.delete()
                if deleted:
                    self.stdout.write(f"Deleted {label}: {deleted}")
            ad, _ = audit_qs.delete()
            if ad:
                self.stdout.write(f"Deleted audit.AuditLog: {ad}")
            ud, _ = users_qs.delete()
            if ud:
                self.stdout.write(f"Deleted accounts.User: {ud}")
            # Cascades CompanySubscription, SubscriptionPayment, VAT/Numbering/Print
            # settings, and any remaining permission overrides.
            company.delete()

        self.stdout.write(self.style.SUCCESS(
            f"Demo tenant '{subdomain}' and its data were deleted."
        ))
