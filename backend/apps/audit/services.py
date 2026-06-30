"""Central audit helpers.

- ``create_audit_log(...)`` writes an :class:`AuditLog` row.
- ``require_reason_for_sensitive_action(...)`` enforces the reason rule.

Future modules call ``record_action(...)`` (the high-level helper) inside the
same ``transaction.atomic()`` block as the action they record so the action and
its audit row commit together.
"""

from rest_framework.exceptions import ValidationError

from .constants import is_sensitive_action, risk_for_action
from .models import AuditLog


class SensitiveActionReasonRequired(ValidationError):
    """Raised (as a DRF 400) when a sensitive action is missing a reason."""

    default_detail = "A reason is required for this sensitive action."


def require_reason_for_sensitive_action(action_code: str, reason: str) -> str:
    """Validate that sensitive actions carry a non-empty reason.

    Returns the cleaned reason. Raises :class:`SensitiveActionReasonRequired`
    (HTTP 400) for sensitive actions with a blank reason.
    """
    cleaned = (reason or "").strip()
    if is_sensitive_action(action_code) and not cleaned:
        raise SensitiveActionReasonRequired(
            {"reason": f"Reason is required for sensitive action '{action_code}'."}
        )
    return cleaned


def _client_meta(request):
    if request is None:
        return None, ""
    ip = request.META.get("REMOTE_ADDR")
    ua = request.META.get("HTTP_USER_AGENT", "")[:512]
    return ip, ua


def create_audit_log(
    *,
    action,
    user=None,
    company=None,
    module="",
    reference_type="",
    reference_id="",
    previous_value=None,
    new_value=None,
    reason="",
    risk_level=None,
    request=None,
):
    """Low-level audit writer. Prefer :func:`record_action` from views."""
    ip, ua = _client_meta(request)
    return AuditLog.objects.create(
        action=action,
        user=user,
        company=company,
        module=module,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else "",
        previous_value=previous_value,
        new_value=new_value,
        reason=reason or "",
        risk_level=risk_level or risk_for_action(action),
        ip_address=ip,
        user_agent=ua,
    )


def record_action(
    *,
    request,
    action,
    module="",
    reference_type="",
    reference_id="",
    previous_value=None,
    new_value=None,
    reason="",
):
    """High-level helper for views: validates reason + writes the audit row.

    Resolves ``user`` and ``company`` from the request automatically.
    """
    reason = require_reason_for_sensitive_action(action, reason)
    user = getattr(request, "user", None)
    company = None
    if user is not None and getattr(user, "is_authenticated", False):
        company = getattr(user, "company", None)
    return create_audit_log(
        action=action,
        user=user if (user and user.is_authenticated) else None,
        company=company,
        module=module,
        reference_type=reference_type,
        reference_id=reference_id,
        previous_value=previous_value,
        new_value=new_value,
        reason=reason,
        request=request,
    )
