"""Tests for tenant-scoped demo data hygiene commands."""

import pytest
from django.core.management import CommandError, call_command

from apps.customers.models import Customer
from apps.products.models import Product, ProductCategory
from apps.tenants.models import Company

pytestmark = pytest.mark.django_db


def test_purge_tenant_demo_data_dry_run(company, owner):
    cat = ProductCategory.objects.create(
        company=company, name_ar="فئة", code="CAT1", sort_order=1
    )
    Product.objects.create(
        company=company, category=cat, name_ar="Gulf Restaurant", sku="SKU1"
    )
    Customer.objects.create(
        company=company, name_ar="Smoke Test Customer", phone="+971500000001"
    )
    Customer.objects.create(
        company=company, name_ar="FIRST VIEW GENERAL TRADING", phone="+971500000002"
    )

    call_command(
        "purge_tenant_demo_data",
        company_subdomain=company.subdomain,
        dry_run=True,
    )
    assert Customer.objects.filter(company=company).count() == 2
    assert Product.objects.filter(company=company).count() == 1


def test_purge_tenant_demo_data_deletes_only_demo_like(company, owner):
    demo = Customer.objects.create(
        company=company, name_ar="Smoke Test Customer", phone="+971500000001"
    )
    real = Customer.objects.create(
        company=company, name_ar="FIRST VIEW GENERAL TRADING", phone="+971500000002"
    )

    call_command(
        "purge_tenant_demo_data",
        company_subdomain=company.subdomain,
        confirm_delete_demo_data=True,
    )
    assert not Customer.objects.filter(pk=demo.pk).exists()
    assert Customer.objects.filter(pk=real.pk).exists()


def test_reset_tenant_operational_data_dry_run(company, owner):
    cat = ProductCategory.objects.create(
        company=company, name_ar="فئة", code="CAT1", sort_order=1
    )
    Product.objects.create(
        company=company, category=cat, name_ar="منتج", sku="SKU1"
    )
    call_command(
        "reset_tenant_operational_data",
        company_subdomain=company.subdomain,
        dry_run=True,
    )
    assert Company.objects.filter(pk=company.pk).exists()
    assert Product.objects.filter(company=company).count() == 1


def test_reset_tenant_operational_data_requires_confirmation(company, owner):
    cat = ProductCategory.objects.create(
        company=company, name_ar="فئة", code="CAT1", sort_order=1
    )
    Product.objects.create(
        company=company, category=cat, name_ar="منتج", sku="SKU1"
    )
    call_command(
        "reset_tenant_operational_data",
        company_subdomain=company.subdomain,
    )
    assert Product.objects.filter(company=company).count() == 1

    call_command(
        "reset_tenant_operational_data",
        company_subdomain=company.subdomain,
        confirm_reset_empty_tenant=True,
    )
    assert Product.objects.filter(company=company).count() == 0
    assert Company.objects.filter(pk=company.pk).exists()
