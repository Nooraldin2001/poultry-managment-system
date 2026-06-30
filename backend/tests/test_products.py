from decimal import Decimal

import pytest

from apps.products.models import Product, ProductCategory, ProductType

pytestmark = pytest.mark.django_db


def test_create_product_category(api, owner):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/tenant/product-categories/",
        {"name_ar": "أجزاء", "code": "PARTS"}, format="json",
    )
    assert resp.status_code == 201, resp.content
    assert ProductCategory.objects.filter(company=owner.company, code="PARTS").exists()


def test_create_fixed_weight_product(api, owner, product_category):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/tenant/products/",
        {
            "category": product_category.id, "name_ar": "دجاج 900", "sku": "P900",
            "product_type": "fixed_weight", "weight_grams": 900,
            "default_pieces_per_carton": 10, "sales_price": "95.00",
            "sales_price_type": "carton",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    assert Product.objects.filter(company=owner.company, sku="P900").exists()


def test_fixed_weight_requires_grams_and_pieces(api, owner, product_category):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/tenant/products/",
        {
            "category": product_category.id, "name_ar": "x", "sku": "XB",
            "product_type": "fixed_weight",
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "weight_grams" in resp.json()
    assert "default_pieces_per_carton" in resp.json()


def test_moving_weight_min_validation(api, owner, product_category):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/tenant/products/",
        {
            "category": product_category.id, "name_ar": "متحرك", "sku": "MV",
            "product_type": "moving_weight", "weight_grams": 1000,
        },
        format="json",
    )
    assert resp.status_code == 400
    assert "weight_grams" in resp.json()


def test_carton_weight_kg_computed(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    resp = api.get(f"/api/v1/tenant/products/{fixed_product.id}/")
    assert resp.status_code == 200
    # 1000g * 10 pieces / 1000 = 10 kg
    assert Decimal(resp.json()["carton_weight_kg"]) == Decimal("10")


def test_negative_price_rejected(api, owner, product_category):
    api.force_authenticate(user=owner)
    resp = api.post(
        "/api/v1/tenant/products/",
        {
            "category": product_category.id, "name_ar": "y", "sku": "NEG",
            "product_type": "other", "sales_price": "-5.00",
        },
        format="json",
    )
    assert resp.status_code == 400


def test_disable_product_requires_reason(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    no_reason = api.post(f"/api/v1/tenant/products/{fixed_product.id}/disable/", {}, format="json")
    assert no_reason.status_code == 400
    ok = api.post(
        f"/api/v1/tenant/products/{fixed_product.id}/disable/",
        {"reason": "Discontinued"}, format="json",
    )
    assert ok.status_code == 200
    fixed_product.refresh_from_db()
    assert fixed_product.is_active is False


def test_reactivate_product(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    api.post(f"/api/v1/tenant/products/{fixed_product.id}/disable/", {"reason": "x"}, format="json")
    resp = api.post(f"/api/v1/tenant/products/{fixed_product.id}/reactivate/", {}, format="json")
    assert resp.status_code == 200
    fixed_product.refresh_from_db()
    assert fixed_product.is_active is True


def test_cross_tenant_product_access_blocked(api, owner, other_owner):
    other_cat = ProductCategory.objects.create(
        company=other_owner.company, name_ar="x", code="X"
    )
    other_product = Product.objects.create(
        company=other_owner.company, category=other_cat, name_ar="other",
        sku="OTH", product_type=ProductType.OTHER,
    )
    api.force_authenticate(user=owner)
    resp = api.get(f"/api/v1/tenant/products/{other_product.id}/")
    assert resp.status_code == 404


def test_cashier_cannot_edit_product(api, cashier, fixed_product):
    api.force_authenticate(user=cashier)
    # cashier can view
    assert api.get(f"/api/v1/tenant/products/{fixed_product.id}/").status_code == 200
    # but cannot edit
    resp = api.patch(
        f"/api/v1/tenant/products/{fixed_product.id}/",
        {"name_ar": "changed"}, format="json",
    )
    assert resp.status_code == 403


def test_price_change_requires_reason(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    no_reason = api.patch(
        f"/api/v1/tenant/products/{fixed_product.id}/",
        {"sales_price": "120.00"}, format="json",
    )
    assert no_reason.status_code == 400
    ok = api.patch(
        f"/api/v1/tenant/products/{fixed_product.id}/",
        {"sales_price": "120.00", "reason": "Market increase"}, format="json",
    )
    assert ok.status_code == 200
    fixed_product.refresh_from_db()
    assert fixed_product.sales_price == Decimal("120.00")
