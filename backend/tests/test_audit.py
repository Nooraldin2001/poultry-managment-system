import pytest

from apps.audit.constants import is_sensitive_action
from apps.audit.models import AuditLog
from apps.audit.services import (
    SensitiveActionReasonRequired,
    require_reason_for_sensitive_action,
)

pytestmark = pytest.mark.django_db


def test_sensitive_action_registry():
    assert is_sensitive_action("vat_rate_change")
    assert is_sensitive_action("permission_change")
    assert not is_sensitive_action("just_a_view")


def test_require_reason_raises_without_reason():
    with pytest.raises(SensitiveActionReasonRequired):
        require_reason_for_sensitive_action("vat_disabled", "")


def test_require_reason_passes_with_reason():
    assert require_reason_for_sensitive_action("vat_disabled", "  legit  ") == "legit"


def test_non_sensitive_action_allows_blank_reason():
    assert require_reason_for_sensitive_action("non_sensitive", "") == ""


def test_audit_log_is_append_only():
    log = AuditLog.objects.create(action="test_action")
    with pytest.raises(ValueError):
        log.reason = "changed"
        log.save()
    with pytest.raises(ValueError):
        log.delete()


def test_permission_change_writes_audit(api, owner, cashier):
    api.force_authenticate(user=owner)
    api.patch(
        f"/api/v1/tenant/users/{cashier.id}/permissions/",
        {"overrides": [{"code": "purchases.view", "allowed": True}],
         "reason": "audit test"},
        format="json",
    )
    entry = AuditLog.objects.filter(action="permission_change").first()
    assert entry is not None
    assert entry.reason == "audit test"
    assert entry.company_id == owner.company_id


def test_audit_log_endpoint_owner_only(api, owner, cashier):
    api.force_authenticate(user=owner)
    assert api.get("/api/v1/tenant/audit-logs/").status_code == 200
    api.force_authenticate(user=cashier)
    assert api.get("/api/v1/tenant/audit-logs/").status_code == 403
