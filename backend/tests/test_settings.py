import pytest

from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db


def test_get_vat_settings(api, owner):
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/tenant/settings/vat/")
    assert resp.status_code == 200
    assert resp.json()["default_vat_rate"] == "5.00"


def test_vat_rate_change_requires_reason(api, owner):
    api.force_authenticate(user=owner)
    resp = api.patch(
        "/api/v1/tenant/settings/vat/",
        {"default_vat_rate": "7.50"},
        format="json",
    )
    assert resp.status_code == 400
    assert "reason" in str(resp.json()).lower()


def test_vat_rate_change_with_reason_audited(api, owner):
    api.force_authenticate(user=owner)
    resp = api.patch(
        "/api/v1/tenant/settings/vat/",
        {"default_vat_rate": "7.50", "reason": "regulatory update"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["default_vat_rate"] == "7.50"
    assert AuditLog.objects.filter(action="vat_rate_change").exists()


def test_vat_rate_cannot_be_negative(api, owner):
    api.force_authenticate(user=owner)
    resp = api.patch(
        "/api/v1/tenant/settings/vat/",
        {"default_vat_rate": "-1", "reason": "x"},
        format="json",
    )
    assert resp.status_code == 400


def test_numbering_change_requires_reason(api, owner, company):
    api.force_authenticate(user=owner)
    numbering = company.numbering_settings.first()
    resp = api.patch(
        f"/api/v1/tenant/settings/numbering/{numbering.id}/",
        {"prefix": "S-"},
        format="json",
    )
    assert resp.status_code == 400
    assert "reason" in str(resp.json()).lower()


def test_numbering_change_with_reason(api, owner, company):
    api.force_authenticate(user=owner)
    numbering = company.numbering_settings.first()
    resp = api.patch(
        f"/api/v1/tenant/settings/numbering/{numbering.id}/",
        {"prefix": "S-", "next_number": 100, "reason": "new sequence"},
        format="json",
    )
    assert resp.status_code == 200
    assert AuditLog.objects.filter(action="numbering_change").exists()


def test_print_templates_listed(api, owner):
    api.force_authenticate(user=owner)
    resp = api.get("/api/v1/tenant/settings/print-templates/")
    assert resp.status_code == 200
    assert len(resp.json()) > 0


def test_cashier_cannot_change_settings(api, cashier):
    api.force_authenticate(user=cashier)
    resp = api.patch(
        "/api/v1/tenant/settings/vat/",
        {"default_vat_rate": "6.00", "reason": "x"},
        format="json",
    )
    assert resp.status_code == 403
