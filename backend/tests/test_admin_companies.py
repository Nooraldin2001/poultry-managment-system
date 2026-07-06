"""Super Admin company profile update tests."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db


def _png_file(name="logo.png"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), (15, 44, 89)).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def test_super_admin_can_update_company_details(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {
            "name_en": "Prime Fresh Updated",
            "manager_phone": "+971501234567",
            "address": "Industrial Area 12",
            "trn": "100488358000003",
        },
        format="json",
    )
    assert res.status_code == 200, res.data
    company.refresh_from_db()
    assert company.name_en == "Prime Fresh Updated"
    assert company.manager_phone == "+971501234567"
    assert company.address == "Industrial Area 12"
    assert company.trn == "100488358000003"


def test_non_super_admin_cannot_update_company_from_admin_endpoint(api, owner, company):
    api.force_authenticate(user=owner)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"name_en": "Hacked"},
        format="json",
    )
    assert res.status_code == 403
    company.refresh_from_db()
    assert company.name_en != "Hacked"


def test_duplicate_subdomain_rejected(api, super_admin, company, other_company):
    api.force_authenticate(user=super_admin)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"subdomain": other_company.subdomain},
        format="json",
    )
    assert res.status_code == 400
    assert "subdomain" in res.data


@pytest.mark.parametrize("bad", ["Prime Fresh", "has_underscore", "bad!", "-lead"])
def test_invalid_subdomain_rejected_on_update(api, super_admin, company, bad):
    api.force_authenticate(user=super_admin)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"subdomain": bad},
        format="json",
    )
    assert res.status_code == 400
    assert "subdomain" in res.data


@pytest.mark.parametrize("reserved", ["admin", "www", "api", "static", "media", "demo", "root", "poultryhero"])
def test_reserved_subdomain_rejected_on_update(api, super_admin, company, reserved):
    api.force_authenticate(user=super_admin)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"subdomain": reserved},
        format="json",
    )
    assert res.status_code == 400
    assert "subdomain" in res.data


def test_valid_subdomain_change_persists(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"subdomain": "prime-fresh-new"},
        format="json",
    )
    assert res.status_code == 200, res.data
    assert res.data["subdomain"] == "prime-fresh-new"
    company.refresh_from_db()
    assert company.subdomain == "prime-fresh-new"


def test_audit_log_created_on_update(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    before_count = AuditLog.objects.filter(action="company_update", reference_id=str(company.id)).count()
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"notes": "Updated by super admin"},
        format="json",
    )
    assert res.status_code == 200, res.data
    logs = AuditLog.objects.filter(action="company_update", reference_id=str(company.id))
    assert logs.count() == before_count + 1
    log = logs.order_by("-id").first()
    assert log.user_id == super_admin.id
    assert log.company_id == company.id
    assert log.new_value.get("notes") == "Updated by super admin"


def test_subscription_not_changed_by_profile_update(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    sub = company.subscription
    plan_code = sub.plan.code
    renewal = sub.renewal_date
    outstanding = sub.outstanding_amount
    total_paid = sub.total_paid

    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {
            "name_en": "Profile Only Change",
            "plan_code": "enterprise",
            "monthly_price": "9999",
            "outstanding_amount": "50000",
        },
        format="json",
    )
    assert res.status_code == 200, res.data
    sub.refresh_from_db()
    assert sub.plan.code == plan_code
    assert sub.renewal_date == renewal
    assert sub.outstanding_amount == outstanding
    assert sub.total_paid == total_paid


def test_tenant_user_still_sees_own_company_only(api, owner, company, other_company):
    other_company.trn = "999999999999999"
    other_company.save()
    api.force_authenticate(user=owner)
    res = api.get("/api/v1/tenant/settings/")
    assert res.status_code == 200
    assert res.data["id"] == company.id
    assert res.data["trn"] != "999999999999999"


def test_tenant_cannot_change_subdomain(api, owner, company):
    api.force_authenticate(user=owner)
    res = api.patch(
        "/api/v1/tenant/settings/company/",
        {"subdomain": "hijacked"},
        format="json",
    )
    assert res.status_code == 200, res.data
    company.refresh_from_db()
    assert company.subdomain == "primefresh"


def test_super_admin_can_upload_assets(api, super_admin, company):
    api.force_authenticate(user=super_admin)
    res = api.patch(
        f"/api/v1/admin/companies/{company.id}/",
        {"logo": _png_file()},
        format="multipart",
    )
    assert res.status_code == 200, res.data
    assert res.data["logo_url"]
