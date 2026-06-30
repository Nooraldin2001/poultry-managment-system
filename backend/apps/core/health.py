"""Lightweight, unauthenticated health-check endpoint."""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """GET /api/v1/health/ — liveness probe (no auth, no DB access)."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "service": "poultryhero-api"})
