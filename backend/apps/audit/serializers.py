from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = [
            "id", "company", "user", "user_email", "module", "action",
            "reference_type", "reference_id", "previous_value", "new_value",
            "reason", "risk_level", "ip_address", "created_at",
        ]
        read_only_fields = fields
