"""Super Admin module-level company data reset orchestration."""

from __future__ import annotations

import hashlib
import json

from django.conf import settings
from django.core import signing
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.audit.services import create_audit_log

from .catalog import MODULE_CATALOG, MODULE_KEYS
from .handlers import CONFIRM_HANDLERS, DRY_RUN_HANDLERS
from .plan import ResetPlan

_SIGNER_SALT = "module-reset-v1"
_TOKEN_MAX_AGE = 3600  # seconds


def required_confirmation_text(company, module: str) -> str:
    subdomain = (company.subdomain or "").strip().lower()
    return f"RESET {module.upper()} FOR {subdomain}"


def _validate_module(module: str) -> str:
    key = (module or "").strip().lower()
    if key not in MODULE_KEYS:
        raise ValidationError({"module": f"Unsupported module: {module}"})
    return key


def _company_payload(company) -> dict:
    return {
        "id": company.id,
        "name_ar": company.name_ar,
        "name_en": company.name_en,
        "subdomain": company.subdomain,
    }


def _plan_payload(company, module: str, plan: ResetPlan) -> dict:
    payload = {
        "company": _company_payload(company),
        "module": module,
        "can_reset": plan.can_reset,
        "danger_level": plan.danger_level,
        "affected_counts": plan.affected_counts,
        "side_effects": plan.side_effects,
        "blocking_dependencies": plan.blocking_dependencies,
        "required_confirmation_text": required_confirmation_text(company, module),
    }
    if plan.blocking_dependencies_ar:
        payload["blocking_dependencies_ar"] = plan.blocking_dependencies_ar
    if plan.required_reset_order:
        payload["required_reset_order"] = plan.required_reset_order
    return payload


def _log_reset_audit(*, action, actor, company, module, plan, reason="", request=None, extra=None):
    new_value = {
        "module": module,
        "can_reset": plan.can_reset,
        "affected_counts": plan.affected_counts,
        "blocking_dependencies": plan.blocking_dependencies,
        "required_reset_order": plan.required_reset_order,
    }
    if extra:
        new_value.update(extra)
    create_audit_log(
        action=action,
        user=actor,
        company=company,
        module="admin",
        reference_type="company",
        reference_id=company.id,
        reason=reason,
        new_value=new_value,
        request=request,
    )


def _token_digest(plan: ResetPlan) -> str:
    payload = json.dumps(plan.affected_counts, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def issue_dry_run_token(company, module: str, plan: ResetPlan) -> str:
    signer = signing.TimestampSigner(salt=_SIGNER_SALT)
    return signer.sign(f"{company.id}:{module}:{_token_digest(plan)}")


def verify_dry_run_token(company, module: str, plan: ResetPlan, token: str | None) -> None:
    if not token:
        if getattr(settings, "REQUIRE_DRY_RUN_TOKEN_MODULE_RESET", True):
            raise ValidationError({"dry_run_token": "Dry-run token is required."})
        return
    signer = signing.TimestampSigner(salt=_SIGNER_SALT)
    try:
        value = signer.unsign(token, max_age=_TOKEN_MAX_AGE)
    except signing.BadSignature as exc:
        raise ValidationError({"dry_run_token": "Invalid or expired dry-run token."}) from exc
    expected = f"{company.id}:{module}:{_token_digest(plan)}"
    if value != expected:
        raise ValidationError(
            {"dry_run_token": "Dry-run token does not match current preview counts."}
        )


class ModuleResetService:
    @staticmethod
    def get_catalog() -> list:
        return list(MODULE_CATALOG)

    @staticmethod
    def dry_run(*, company, module: str, actor) -> dict:
        if not getattr(actor, "is_superuser", False):
            raise PermissionDenied("Super Admin access required.")
        module = _validate_module(module)
        handler = DRY_RUN_HANDLERS[module]
        plan = handler(company)
        data = _plan_payload(company, module, plan)
        if plan.can_reset:
            data["dry_run_token"] = issue_dry_run_token(company, module, plan)
            _log_reset_audit(
                action="module_reset_dry_run",
                actor=actor,
                company=company,
                module=module,
                plan=plan,
            )
        else:
            _log_reset_audit(
                action="module_reset_blocked",
                actor=actor,
                company=company,
                module=module,
                plan=plan,
            )
        return data

    @staticmethod
    def confirm(
        *,
        company,
        module: str,
        actor,
        reason: str,
        confirmation_text: str,
        dry_run_token: str | None = None,
        backup_confirmed: bool = False,
        request=None,
    ) -> dict:
        if not getattr(actor, "is_superuser", False):
            raise PermissionDenied("Super Admin access required.")
        module = _validate_module(module)
        cleaned_reason = (reason or "").strip()
        if not cleaned_reason:
            raise ValidationError({"reason": "Reason is required for module reset."})

        if getattr(settings, "REQUIRE_BACKUP_BEFORE_MODULE_RESET", False) and not backup_confirmed:
            raise ValidationError(
                {"backup_confirmed": "You must confirm a database backup exists before reset."}
            )

        expected = required_confirmation_text(company, module)
        if (confirmation_text or "").strip() != expected:
            raise ValidationError(
                {
                    "confirmation_text": (
                        f"Confirmation text must exactly match: {expected}"
                    )
                }
            )

        preview = DRY_RUN_HANDLERS[module](company)
        if not preview.can_reset:
            _log_reset_audit(
                action="module_reset_blocked",
                actor=actor,
                company=company,
                module=module,
                plan=preview,
                reason=cleaned_reason,
                request=request,
                extra={"attempt": "confirm"},
            )
            raise ValidationError({
                "detail": "Reset is blocked. Resolve dependencies first.",
                "blocking_dependencies": preview.blocking_dependencies,
                "blocking_dependencies_ar": preview.blocking_dependencies_ar,
                "required_reset_order": preview.required_reset_order,
            })
        verify_dry_run_token(company, module, preview, dry_run_token)

        confirm_handler = CONFIRM_HANDLERS[module]
        result_plan = confirm_handler(company)

        summary = {
            "company": _company_payload(company),
            "module": module,
            "success": True,
            "deleted_counts": result_plan.deleted_counts,
            "recalculation": result_plan.recalculation,
            "completed_at": timezone.now().isoformat(),
        }
        create_audit_log(
            action="module_reset_confirm",
            user=actor,
            company=company,
            module="admin",
            reference_type="company",
            reference_id=company.id,
            reason=cleaned_reason,
            previous_value={
                "module": module,
                "dry_run_counts": preview.affected_counts,
                "confirmation_text": confirmation_text.strip(),
            },
            new_value=summary,
            request=request,
        )
        return summary

    @staticmethod
    def history(*, company, limit: int = 50) -> list:
        from apps.audit.models import AuditLog

        qs = AuditLog.objects.filter(
            company=company,
            action__in=(
                "module_reset_dry_run",
                "module_reset_confirm",
                "module_reset_blocked",
            ),
        ).order_by("-created_at")[:limit]
        return [
            {
                "id": row.id,
                "action": row.action,
                "module": (row.new_value or {}).get("module")
                or (row.previous_value or {}).get("module"),
                "reason": row.reason,
                "user_id": row.user_id,
                "user_email": getattr(row.user, "email", None) if row.user_id else None,
                "new_value": row.new_value,
                "previous_value": row.previous_value,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in qs
        ]
