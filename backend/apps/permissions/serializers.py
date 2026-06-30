from rest_framework import serializers

from .models import PermissionCode


class PermissionCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermissionCode
        fields = ["code", "group", "action", "label", "is_sensitive"]


class PermissionOverrideItemSerializer(serializers.Serializer):
    code = serializers.CharField()
    allowed = serializers.BooleanField()

    def validate_code(self, value):
        if not PermissionCode.objects.filter(code=value, is_active=True).exists():
            raise serializers.ValidationError(f"Unknown permission code: {value}")
        return value


class UserPermissionsUpdateSerializer(serializers.Serializer):
    overrides = PermissionOverrideItemSerializer(many=True)
    reason = serializers.CharField(required=False, allow_blank=True)
