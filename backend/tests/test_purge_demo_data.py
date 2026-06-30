"""Tests for the `purge_demo_data` management command (Phase 4A data hygiene)."""

import pytest
from django.core.management import CommandError, call_command

from apps.audit.models import AuditLog
from apps.permissions.models import PermissionCode, UserPermissionOverride
from apps.products.models import Product, ProductCategory
from apps.subscriptions.models import Plan
from apps.tenants.models import Company

pytestmark = pytest.mark.django_db


def _seed_tenant_rows(company, owner):
    """Create a few tenant-owned rows so we can verify they get purged."""
    cat = ProductCategory.objects.create(
        company=company, name_ar="فئة", code="CAT1", sort_order=1
    )
    Product.objects.create(
        company=company, category=cat, name_ar="منتج", sku="SKU1",
    )
    AuditLog.objects.create(company=company, action="demo_action")
    perm = PermissionCode.objects.first()
    UserPermissionOverride.objects.create(
        company=company, user=owner, permission=perm, allowed=True
    )


def test_refuses_without_confirmation(company, owner):
    _seed_tenant_rows(company, owner)
    with pytest.raises(CommandError):
        call_command("purge_demo_data", company_subdomain="primefresh")
    # Nothing deleted.
    assert Company.objects.filter(subdomain="primefresh").exists()
    assert Product.objects.filter(company=company).exists()


def test_dry_run_deletes_nothing(company, owner):
    _seed_tenant_rows(company, owner)
    call_command("purge_demo_data", company_subdomain="primefresh", dry_run=True)
    assert Company.objects.filter(subdomain="primefresh").exists()
    assert Product.objects.filter(company=company).count() == 1
    assert AuditLog.objects.filter(company=company).count() == 1


def test_does_not_delete_reference_seeds(company, owner):
    _seed_tenant_rows(company, owner)
    plans_before = Plan.objects.count()
    perms_before = PermissionCode.objects.count()
    assert plans_before > 0 and perms_before > 0

    call_command(
        "purge_demo_data",
        company_subdomain="primefresh",
        confirm_delete_demo_data=True,
    )

    assert Plan.objects.count() == plans_before
    assert PermissionCode.objects.count() == perms_before


def test_deletes_only_target_demo_company(company, owner, other_company, other_owner):
    _seed_tenant_rows(company, owner)
    _seed_tenant_rows(other_company, other_owner)

    call_command(
        "purge_demo_data",
        company_subdomain="primefresh",
        confirm_delete_demo_data=True,
    )

    # Target demo company fully gone.
    assert not Company.objects.filter(subdomain="primefresh").exists()
    assert not Product.objects.filter(company=company).exists()
    assert not AuditLog.objects.filter(company=company).exists()

    # The other company and its data are untouched.
    assert Company.objects.filter(subdomain="competitor").exists()
    assert Product.objects.filter(company=other_company).count() == 1
    assert AuditLog.objects.filter(company=other_company).count() == 1


def test_refuses_unknown_company():
    with pytest.raises(CommandError):
        call_command(
            "purge_demo_data",
            company_subdomain="does-not-exist",
            confirm_delete_demo_data=True,
        )


def test_refuses_nonstandard_subdomain(other_company, other_owner):
    """An existing but non-demo subdomain is refused unless explicitly allowed."""
    _seed_tenant_rows(other_company, other_owner)
    with pytest.raises(CommandError):
        call_command(
            "purge_demo_data",
            company_subdomain="competitor",
            confirm_delete_demo_data=True,
        )
    assert Company.objects.filter(subdomain="competitor").exists()

    # With the override it proceeds.
    call_command(
        "purge_demo_data",
        company_subdomain="competitor",
        confirm_delete_demo_data=True,
        allow_nonstandard_subdomain=True,
    )
    assert not Company.objects.filter(subdomain="competitor").exists()
