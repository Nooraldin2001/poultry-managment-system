from rest_framework import serializers

from .module_reset.catalog import MODULE_KEYS
from .module_reset.dependencies import FORCE_RESET_KEYS, FORCE_RESET_MESSAGE


class _RejectForceResetMixin:
    def _reject_force_flags(self) -> None:
        initial = getattr(self, "initial_data", None) or {}
        for key in FORCE_RESET_KEYS:
            if key in initial and initial[key]:
                raise serializers.ValidationError({"detail": FORCE_RESET_MESSAGE})


class ModuleResetDryRunSerializer(_RejectForceResetMixin, serializers.Serializer):
    module = serializers.ChoiceField(choices=[(k, k) for k in MODULE_KEYS])

    def validate(self, attrs):
        self._reject_force_flags()
        return attrs


class ModuleResetConfirmSerializer(_RejectForceResetMixin, serializers.Serializer):
    module = serializers.ChoiceField(choices=[(k, k) for k in MODULE_KEYS])
    confirmation_text = serializers.CharField()
    reason = serializers.CharField()
    dry_run_token = serializers.CharField(required=False, allow_blank=True)
    backup_confirmed = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        self._reject_force_flags()
        return attrs

    def validate_reason(self, value):
        if not (value or "").strip():
            raise serializers.ValidationError("Reason is required.")
        return value.strip()
