from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.audit.models import AuditLog
from apps.core.enums import PaymentMethod
from apps.products.models import Product, ProductCategory, ProductType
from apps.suppliers.constants import CATEGORY_SLAUGHTERHOUSE, CATEGORY_TRANSPORT
from apps.suppliers.models import Supplier, SupplierCategory, SupplierSpecialPrice

pytestmark = pytest.mark.django_db


def _create_supplier(api, **overrides):
    payload = {
        "name_ar": "مورد", "phone": "+971600000000",
        "supplier_type": "credit", "opening_balance": "0.00",
        "opening_balance_type": "zero",
    }
    payload.update(overrides)
    return api.post("/api/v1/tenant/suppliers/", payload, format="json")


def test_create_we_owe_supplier(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_supplier(
        api, opening_balance="1000.00", opening_balance_type="we_owe_supplier"
    )
    assert resp.status_code == 201, resp.content
    # we owe supplier -> positive payable
    assert Decimal(resp.json()["current_balance"]) == Decimal("1000.00")


def test_create_supplier_owes_us(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_supplier(
        api, opening_balance="400.00", opening_balance_type="supplier_owes_us"
    )
    assert resp.status_code == 201
    assert Decimal(resp.json()["current_balance"]) == Decimal("-400.00")


def test_supplier_opening_ledger_entry(api, owner):
    api.force_authenticate(user=owner)
    sid = _create_supplier(
        api, opening_balance="700.00", opening_balance_type="we_owe_supplier"
    ).json()["id"]
    ledger = api.get(f"/api/v1/tenant/suppliers/{sid}/ledger/")
    rows = ledger.json()
    assert len(rows) == 1
    assert Decimal(rows[0]["credit"]) == Decimal("700.00")


def test_supplier_special_price_same_company_only(api, owner, fixed_product, other_owner):
    api.force_authenticate(user=owner)
    sid = _create_supplier(api).json()["id"]
    other_cat = ProductCategory.objects.create(company=other_owner.company, name_ar="x", code="X")
    other_product = Product.objects.create(
        company=other_owner.company, category=other_cat, name_ar="o", sku="O1",
        product_type=ProductType.OTHER,
    )
    bad = api.post(
        f"/api/v1/tenant/suppliers/{sid}/special-prices/",
        {"product": other_product.id, "price": "8.00", "price_type": "kg", "reason": "deal"},
        format="json",
    )
    assert bad.status_code == 400
    good = api.post(
        f"/api/v1/tenant/suppliers/{sid}/special-prices/",
        {"product": fixed_product.id, "price": "8.00", "price_type": "kg", "reason": "deal"},
        format="json",
    )
    assert good.status_code == 201


def test_duplicate_active_supplier_special_price_blocked(owner, fixed_product):
    supplier = Supplier.objects.create(
        company=owner.company, name_ar="s", phone="123", supplier_type="credit"
    )
    SupplierSpecialPrice.objects.create(
        company=owner.company, supplier=supplier, product=fixed_product,
        price=Decimal("8"), price_type="kg", is_active=True,
    )
    with pytest.raises(IntegrityError):
        SupplierSpecialPrice.objects.create(
            company=owner.company, supplier=supplier, product=fixed_product,
            price=Decimal("9"), price_type="kg", is_active=True,
        )


def test_supplier_agreement_created(api, owner):
    api.force_authenticate(user=owner)
    sid = _create_supplier(api).json()["id"]
    resp = api.post(
        f"/api/v1/tenant/suppliers/{sid}/agreements/",
        {"agreement_type": "general_note", "title": "Notes", "description": "ok"},
        format="json",
    )
    assert resp.status_code == 201, resp.content


def test_financial_agreement_change_requires_reason(api, owner):
    api.force_authenticate(user=owner)
    sid = _create_supplier(api).json()["id"]
    resp = api.post(
        f"/api/v1/tenant/suppliers/{sid}/agreements/",
        {"agreement_type": "slaughter_deduction", "title": "Deduction", "default_amount": "2.00"},
        format="json",
    )
    assert resp.status_code == 400  # financial agreement needs a reason


def test_cross_tenant_supplier_access_blocked(api, owner, other_owner):
    other_supplier = Supplier.objects.create(
        company=other_owner.company, name_ar="x", phone="999", supplier_type="cash"
    )
    api.force_authenticate(user=owner)
    assert api.get(f"/api/v1/tenant/suppliers/{other_supplier.id}/").status_code == 404


def test_cashier_supplier_access_blocked(api, cashier):
    api.force_authenticate(user=cashier)
    assert api.get("/api/v1/tenant/suppliers/").status_code == 403


def test_supplier_sensitive_action_audit(api, owner):
    api.force_authenticate(user=owner)
    sid = _create_supplier(api).json()["id"]
    api.post(
        f"/api/v1/tenant/suppliers/{sid}/agreements/",
        {"agreement_type": "transport_deduction", "title": "T", "default_amount": "1.00", "reason": "agreed"},
        format="json",
    )
    assert AuditLog.objects.filter(
        company=owner.company, action="supplier_agreement_change"
    ).exists()


def _category(company, code, name_ar):
    return SupplierCategory.objects.create(
        company=company, code=code, name_ar=name_ar, name_en=code,
    )


def test_create_supplier_with_bank_default_payment_method(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_supplier(api, default_payment_method="bank")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    detail = api.get(f"/api/v1/tenant/suppliers/{body['id']}/").json()
    assert detail["default_payment_method"] == PaymentMethod.BANK


def test_edit_supplier_to_bank_default_payment_method(api, owner):
    api.force_authenticate(user=owner)
    sid = _create_supplier(api, default_payment_method="cash").json()["id"]
    patch = api.patch(
        f"/api/v1/tenant/suppliers/{sid}/",
        {"default_payment_method": "bank"},
        format="json",
    )
    assert patch.status_code == 200, patch.content
    assert patch.json()["default_payment_method"] == PaymentMethod.BANK


def test_create_slaughterhouse_supplier_with_bank(api, owner):
    api.force_authenticate(user=owner)
    cat = _category(owner.company, CATEGORY_SLAUGHTERHOUSE, "مسلخ")
    resp = _create_supplier(
        api, category=cat.id, default_payment_method="bank", name_ar="مسلخ العين",
    )
    assert resp.status_code == 201, resp.content
    assert resp.json()["default_payment_method"] == PaymentMethod.BANK


def test_create_transport_supplier_with_bank(api, owner):
    api.force_authenticate(user=owner)
    cat = _category(owner.company, CATEGORY_TRANSPORT, "نقل")
    resp = _create_supplier(
        api, category=cat.id, default_payment_method="bank", name_ar="نقل الإمارات",
    )
    assert resp.status_code == 201, resp.content
    assert resp.json()["default_payment_method"] == PaymentMethod.BANK


def test_invalid_supplier_default_payment_method_rejected(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_supplier(api, default_payment_method="bank_account")
    assert resp.status_code == 400
    assert "default_payment_method" in resp.json()


def test_bank_transfer_alias_normalized_to_bank(api, owner):
    api.force_authenticate(user=owner)
    resp = _create_supplier(api, default_payment_method="bank_transfer")
    assert resp.status_code == 201, resp.content
    assert resp.json()["default_payment_method"] == PaymentMethod.BANK


def test_supplier_bank_default_maps_to_purchase_bank_transfer():
    from apps.core.payment_methods import supplier_default_to_purchase_payment_method

    assert supplier_default_to_purchase_payment_method("bank") == "bank_transfer"
    assert supplier_default_to_purchase_payment_method("credit") == "credit"
    assert supplier_default_to_purchase_payment_method("cash") == "cash"
