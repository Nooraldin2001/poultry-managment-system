from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.audit.models import AuditLog
from apps.customers.models import Customer, CustomerSpecialPrice
from apps.products.models import Product, ProductCategory, ProductType

pytestmark = pytest.mark.django_db


def _create_customer(api, **overrides):
    payload = {
        "name_ar": "عميل", "phone": "+971500000000",
        "customer_type": "credit", "opening_balance": "0.00",
        "opening_balance_type": "zero",
    }
    payload.update(overrides)
    return api.post("/api/v1/tenant/customers/", payload, format="json")


def test_create_customer_owes_us(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_customer(
        api, name_ar="مدين", opening_balance="1000.00",
        opening_balance_type="customer_owes_us",
    )
    assert resp.status_code == 201, resp.content
    assert Decimal(resp.json()["current_balance"]) == Decimal("1000.00")


def test_create_we_owe_customer(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_customer(
        api, name_ar="دائن", opening_balance="500.00",
        opening_balance_type="we_owe_customer",
    )
    assert resp.status_code == 201
    assert Decimal(resp.json()["current_balance"]) == Decimal("-500.00")


def test_opening_balance_creates_ledger_entry(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_customer(
        api, opening_balance="300.00", opening_balance_type="customer_owes_us"
    )
    cid = resp.json()["id"]
    ledger = api.get(f"/api/v1/tenant/customers/{cid}/ledger/")
    assert ledger.status_code == 200
    rows = ledger.json()
    assert len(rows) == 1
    assert rows[0]["entry_type"] == "opening_balance"
    assert Decimal(rows[0]["debit"]) == Decimal("300.00")


def test_zero_opening_balance_no_ledger(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_customer(api, opening_balance="0.00", opening_balance_type="zero")
    cid = resp.json()["id"]
    assert api.get(f"/api/v1/tenant/customers/{cid}/ledger/").json() == []


def test_update_opening_balance_requires_reason(api, owner):
    api.force_authenticate(user=owner)
    cid = _create_customer(
        api, opening_balance="100.00", opening_balance_type="customer_owes_us"
    ).json()["id"]
    no_reason = api.post(
        f"/api/v1/tenant/customers/{cid}/opening-balance/",
        {"opening_balance": "250.00", "opening_balance_type": "customer_owes_us"},
        format="json",
    )
    assert no_reason.status_code == 400
    ok = api.post(
        f"/api/v1/tenant/customers/{cid}/opening-balance/",
        {"opening_balance": "250.00", "opening_balance_type": "customer_owes_us", "reason": "correction"},
        format="json",
    )
    assert ok.status_code == 200
    assert Decimal(ok.json()["current_balance"]) == Decimal("250.00")


def test_credit_limit_change_requires_reason(api, owner):
    api.force_authenticate(user=owner)
    cid = _create_customer(api).json()["id"]
    no_reason = api.post(
        f"/api/v1/tenant/customers/{cid}/credit-limit/",
        {"new_limit": "5000.00"}, format="json",
    )
    assert no_reason.status_code == 400
    ok = api.post(
        f"/api/v1/tenant/customers/{cid}/credit-limit/",
        {"new_limit": "5000.00", "reason": "Good payer"}, format="json",
    )
    assert ok.status_code == 201
    Customer.objects.get(id=cid).credit_limit == Decimal("5000.00")


def test_special_price_same_company_only(api, owner, fixed_product, other_owner):
    api.force_authenticate(user=owner)
    cid = _create_customer(api).json()["id"]
    other_cat = ProductCategory.objects.create(company=other_owner.company, name_ar="x", code="X")
    other_product = Product.objects.create(
        company=other_owner.company, category=other_cat, name_ar="o", sku="O1",
        product_type=ProductType.OTHER,
    )
    bad = api.post(
        f"/api/v1/tenant/customers/{cid}/special-prices/",
        {"product": other_product.id, "price": "10.00", "price_type": "kg", "reason": "deal"},
        format="json",
    )
    assert bad.status_code == 400
    good = api.post(
        f"/api/v1/tenant/customers/{cid}/special-prices/",
        {"product": fixed_product.id, "price": "10.00", "price_type": "kg", "reason": "deal"},
        format="json",
    )
    assert good.status_code == 201


def test_duplicate_active_special_price_blocked(owner, fixed_product):
    customer = Customer.objects.create(
        company=owner.company, name_ar="c", phone="123", customer_type="credit"
    )
    CustomerSpecialPrice.objects.create(
        company=owner.company, customer=customer, product=fixed_product,
        price=Decimal("10"), price_type="kg", is_active=True,
    )
    with pytest.raises(IntegrityError):
        CustomerSpecialPrice.objects.create(
            company=owner.company, customer=customer, product=fixed_product,
            price=Decimal("11"), price_type="kg", is_active=True,
        )


def test_free_product_conditional_validation(api, owner, fixed_product):
    api.force_authenticate(user=owner)
    cid = _create_customer(api).json()["id"]
    bad = api.post(
        f"/api/v1/tenant/customers/{cid}/free-products/",
        {"product": fixed_product.id, "agreement_type": "minimum_invoice_amount"},
        format="json",
    )
    assert bad.status_code == 400
    good = api.post(
        f"/api/v1/tenant/customers/{cid}/free-products/",
        {"product": fixed_product.id, "agreement_type": "minimum_invoice_amount", "condition_amount": "500.00"},
        format="json",
    )
    assert good.status_code == 201


def test_cross_tenant_customer_access_blocked(api, owner, other_owner):
    other_customer = Customer.objects.create(
        company=other_owner.company, name_ar="x", phone="999", customer_type="cash"
    )
    api.force_authenticate(user=owner)
    assert api.get(f"/api/v1/tenant/customers/{other_customer.id}/").status_code == 404


def test_inactive_customer_reactivation(api, owner):
    api.force_authenticate(user=owner)
    cid = _create_customer(api).json()["id"]
    api.post(f"/api/v1/tenant/customers/{cid}/disable/", {"reason": "x"}, format="json")
    resp = api.post(f"/api/v1/tenant/customers/{cid}/reactivate/", {}, format="json")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


def test_create_customer_missing_required_fields(api, owner):
    api.force_authenticate(user=owner)
    resp = api.post("/api/v1/tenant/customers/", {"phone": "+971500000001"}, format="json")
    assert resp.status_code == 400
    assert "name_ar" in resp.json()

    resp = api.post("/api/v1/tenant/customers/", {"name_ar": "Test"}, format="json")
    assert resp.status_code == 400
    assert "phone" in resp.json()


def test_list_includes_newly_created_customer(api, owner):
    api.force_authenticate(user=owner)
    create = _create_customer(api, name_ar="Smoke List Customer", phone="+971500000099")
    assert create.status_code == 201, create.content
    cid = create.json()["id"]
    resp = api.get("/api/v1/tenant/customers/")
    assert resp.status_code == 200
    ids = [row["id"] for row in resp.json()["results"]]
    assert cid in ids


def test_cashier_cannot_create_customer(api, cashier):
    api.force_authenticate(user=cashier)
    resp = _create_customer(api, name_ar="Blocked", phone="+971500000088")
    assert resp.status_code == 403


def test_cannot_disable_customer_with_balance_without_reason(api, owner):
    api.force_authenticate(user=owner)
    cid = _create_customer(
        api, opening_balance="100.00", opening_balance_type="customer_owes_us"
    ).json()["id"]
    resp = api.post(f"/api/v1/tenant/customers/{cid}/disable/", {}, format="json")
    assert resp.status_code == 400


def test_sensitive_action_creates_audit_log(api, owner):
    api.force_authenticate(user=owner)
    cid = _create_customer(api).json()["id"]
    api.post(
        f"/api/v1/tenant/customers/{cid}/credit-limit/",
        {"new_limit": "5000.00", "reason": "Good payer"}, format="json",
    )
    assert AuditLog.objects.filter(
        company=owner.company, action="customer_credit_limit_change"
    ).exists()
