"""Tenant provisioning service.

Creates a company together with its subscription and default settings so a new
tenant is immediately usable. Used by the Super Admin create-company endpoint.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import TenantRole, User
from apps.company_settings.constants import DocumentType, TemplateType
from apps.company_settings.models import (
    NumberingSettings,
    PrintTemplateSettings,
    VATSettings,
)
from apps.subscriptions.models import (
    BillingCycle,
    CompanySubscription,
    Plan,
    SubscriptionStatus,
)

from .models import Company, CompanyStatus

TRIAL_DAYS = 14

# Sensible default numbering prefixes per document type.
DEFAULT_PREFIXES = {
    DocumentType.SALES_INVOICE: "INV-",
    DocumentType.PURCHASE_INVOICE: "PINV-",
    DocumentType.QUOTATION: "QT-",
    DocumentType.CUSTOMER_RECEIPT: "RCV-",
    DocumentType.SUPPLIER_PAYMENT_RECEIPT: "PAY-",
    DocumentType.EXPENSE_VOUCHER: "EXP-",
    DocumentType.COLLECTION_ADJUSTMENT: "ADJ-",
    DocumentType.STOCK_ADJUSTMENT: "STK-",
    DocumentType.CUSTOMER_REFUND: "CRF-",
    DocumentType.SUPPLIER_REFUND: "SRF-",
}


def _create_default_settings(company: Company):
    VATSettings.objects.get_or_create(company=company)

    numbering = [
        NumberingSettings(
            company=company,
            document_type=doc_type,
            prefix=prefix,
            next_number=1,
            number_length=5,
        )
        for doc_type, prefix in DEFAULT_PREFIXES.items()
    ]
    NumberingSettings.objects.bulk_create(numbering, ignore_conflicts=True)

    templates = [
        PrintTemplateSettings(company=company, template_type=tt)
        for tt in TemplateType.values
    ]
    PrintTemplateSettings.objects.bulk_create(templates, ignore_conflicts=True)


@transaction.atomic
def provision_company(
    *,
    name_ar,
    name_en,
    subdomain,
    plan: Plan,
    created_by=None,
    billing_cycle=BillingCycle.MONTHLY,
    status=CompanyStatus.TRIAL,
    **company_fields,
):
    """Create a company + subscription + default settings atomically."""
    company = Company.objects.create(
        name_ar=name_ar,
        name_en=name_en,
        subdomain=subdomain.lower(),
        status=status,
        created_by=created_by,
        **company_fields,
    )

    today = timezone.now().date()
    sub_status = (
        SubscriptionStatus.TRIAL
        if status == CompanyStatus.TRIAL
        else SubscriptionStatus.ACTIVE
    )
    CompanySubscription.objects.create(
        company=company,
        plan=plan,
        status=sub_status,
        billing_cycle=billing_cycle,
        start_date=today,
        trial_end_date=today + timedelta(days=TRIAL_DAYS),
        renewal_date=today + timedelta(days=30),
        monthly_price_snapshot=plan.monthly_price,
        yearly_price_snapshot=plan.yearly_price,
    )

    _create_default_settings(company)
    return company


@transaction.atomic
def create_first_admin_user(*, company, email, password, full_name="", phone=""):
    """Create the first Owner/Admin user for a tenant (Super Admin action).

    The first admin is always allowed (the plan user limit is >= 1), but we still
    guard against a zero-seat plan.
    """
    from apps.accounts.services import assert_can_add_user

    assert_can_add_user(company)
    return User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        phone=phone,
        company=company,
        role=TenantRole.OWNER_ADMIN,
        force_password_change=True,
    )
