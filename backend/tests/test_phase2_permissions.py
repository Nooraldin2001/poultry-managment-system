import pytest

from apps.permissions.services import has_permission

pytestmark = pytest.mark.django_db


def test_owner_can_manage_all_phase2(api, owner, product_category):
    api.force_authenticate(user=owner)
    # product
    p = api.post(
        "/api/v1/tenant/products/",
        {"category": product_category.id, "name_ar": "x", "sku": "S1", "product_type": "other"},
        format="json",
    )
    assert p.status_code == 201
    # customer
    c = api.post(
        "/api/v1/tenant/customers/",
        {"name_ar": "c", "phone": "1", "customer_type": "cash"}, format="json",
    )
    assert c.status_code == 201
    # supplier
    s = api.post(
        "/api/v1/tenant/suppliers/",
        {"name_ar": "s", "phone": "1", "supplier_type": "cash"}, format="json",
    )
    assert s.status_code == 201


def test_accountant_defaults(accountant):
    # Allowed by seed defaults
    assert has_permission(accountant, "products.view")
    assert has_permission(accountant, "products.create")
    assert has_permission(accountant, "customers.create")
    assert has_permission(accountant, "customers.view_balance")
    assert has_permission(accountant, "suppliers.view")
    # Conservative: not allowed by default
    assert not has_permission(accountant, "customers.special_prices.manage")
    assert not has_permission(accountant, "customers.edit_opening_balance")
    assert not has_permission(accountant, "suppliers.special_prices.manage")


def test_cashier_defaults(cashier):
    assert has_permission(cashier, "products.view")
    assert has_permission(cashier, "customers.view")
    assert not has_permission(cashier, "products.edit")
    assert not has_permission(cashier, "suppliers.view")


def test_accountant_cannot_manage_special_prices(api, accountant, fixed_product):
    from apps.customers.models import Customer

    customer = Customer.objects.create(
        company=accountant.company, name_ar="c", phone="1", customer_type="credit"
    )
    api.force_authenticate(user=accountant)
    resp = api.post(
        f"/api/v1/tenant/customers/{customer.id}/special-prices/",
        {"product": fixed_product.id, "price": "10.00", "price_type": "kg", "reason": "x"},
        format="json",
    )
    assert resp.status_code == 403


def test_cashier_cannot_create_product(api, cashier, product_category):
    api.force_authenticate(user=cashier)
    resp = api.post(
        "/api/v1/tenant/products/",
        {"category": product_category.id, "name_ar": "x", "sku": "S2", "product_type": "other"},
        format="json",
    )
    assert resp.status_code == 403
