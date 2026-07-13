"""DRF exception handler — always return JSON (never Django HTML error pages)."""

from __future__ import annotations

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def poultryhero_exception_handler(exc, context):
    """Map uncaught exceptions to structured JSON for API clients."""
    if isinstance(exc, Http404):
        exc = APIException(detail="Not found.")
        exc.status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, DjangoPermissionDenied):
        exc = PermissionDenied(detail=str(exc) or "Permission denied.")

    response = drf_exception_handler(exc, context)

    if response is not None:
        return response

    view = context.get("view")
    view_name = type(view).__name__ if view else "unknown"
    logger.exception("Unhandled API exception in %s", view_name)

    return Response(
        {
            "detail": "An unexpected server error occurred. Please contact support.",
            "code": "server_error",
            "fields": {},
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
