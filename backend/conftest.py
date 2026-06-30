import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import TenantRole, User
from apps.accounts.services import create_tenant_user
from apps.subscriptions.models import Plan, PlanCode
from apps.tenants.services import create_first_admin_user, provision_company


@pytest.fixture(autouse=True)
def seed_reference_data(db):
    """Seed plans + permissions for every test (fresh in-memory DB)."""
    call_command("seed_plans")
    call_command("seed_permissions")


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def super_admin(db):
    return User.objects.create_superuser(
        email="admin@poultryhero.solutions",
        password="AdminPass123",
        full_name="Platform Admin",
    )


@pytest.fixture
def company(db):
    plan = Plan.objects.get(code=PlanCode.PRO)
    return provision_company(
        name_ar="برايم فريش",
        name_en="Prime Fresh Poultry",
        subdomain="primefresh",
        plan=plan,
        emirate="Dubai",
    )


@pytest.fixture
def basic_company(db):
    """A company on the Basic plan (user_limit = 3)."""
    plan = Plan.objects.get(code=PlanCode.BASIC)
    return provision_company(
        name_ar="شركة أساسية",
        name_en="Basic Co",
        subdomain="basicco",
        plan=plan,
    )


@pytest.fixture
def owner(company):
    return create_first_admin_user(
        company=company,
        email="owner@primefresh.test",
        password="OwnerPass123",
        full_name="Owner Admin",
    )


@pytest.fixture
def cashier(company):
    return create_tenant_user(
        company=company,
        email="cashier@primefresh.test",
        password="CashierPass123",
        full_name="Cashier User",
        role=TenantRole.CASHIER_SALES,
    )


@pytest.fixture
def accountant(company):
    return create_tenant_user(
        company=company,
        email="acct@primefresh.test",
        password="AcctPass123",
        full_name="Accountant User",
        role=TenantRole.ACCOUNTANT,
    )


@pytest.fixture
def other_company(db):
    plan = Plan.objects.get(code=PlanCode.PRO)
    return provision_company(
        name_ar="منافس", name_en="Competitor Co", subdomain="competitor", plan=plan
    )


@pytest.fixture
def other_owner(other_company):
    return create_first_admin_user(
        company=other_company,
        email="owner@competitor.test",
        password="OwnerPass123",
        full_name="Competitor Owner",
    )


@pytest.fixture
def product_category(company):
    from apps.products.models import ProductCategory

    return ProductCategory.objects.create(
        company=company, name_ar="أوزان ثابتة", code="FIXED", sort_order=1
    )


@pytest.fixture
def fixed_product(company, product_category):
    from decimal import Decimal

    from apps.products.models import Product, ProductType

    return Product.objects.create(
        company=company, category=product_category,
        name_ar="دجاج 1000", sku="P1000", product_type=ProductType.FIXED_WEIGHT,
        weight_grams=1000, default_pieces_per_carton=10,
        sales_price=Decimal("100.00"),
    )
