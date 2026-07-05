"""Company-settings domain services.

Document numbering: ``generate_document_number`` atomically increments the
per-company, per-document-type counter in :class:`NumberingSettings` and formats
a number like ``PINV-2026-00001``. Safe under concurrency via ``select_for_update``.
"""

from django.db import transaction
from django.utils import timezone

from .constants import (
    DEFAULT_DOCUMENT_PREFIXES,
    ResetRule,
    default_numbering_reset_rule,
)
from .models import NumberingSettings


def _format_number(prefix: str, year: int, seq: int, length: int, reset_rule: str) -> str:
    seq_str = str(seq).zfill(length)
    base = prefix or ""
    if reset_rule == ResetRule.NONE:
        return f"{base}{seq_str}"
    # Monthly/yearly include the year (monthly also keeps it simple: year-seq).
    return f"{base}{year}-{seq_str}"


@transaction.atomic
def generate_document_number(company, document_type) -> str:
    """Return the next formatted document number for ``document_type``.

    Locks the company's numbering row and increments ``next_number``. Creates a
    default numbering row (no prefix) if one does not exist yet.
    """
    settings_qs = NumberingSettings.objects.select_for_update().filter(
        company=company, document_type=document_type
    )
    numbering = settings_qs.first()
    if numbering is None:
        numbering = NumberingSettings.objects.create(
            company=company,
            document_type=document_type,
            prefix=DEFAULT_DOCUMENT_PREFIXES.get(document_type, ""),
            next_number=1,
            number_length=4,
            reset_rule=default_numbering_reset_rule(document_type),
        )
        numbering = (
            NumberingSettings.objects.select_for_update()
            .get(pk=numbering.pk)
        )

    seq = numbering.next_number
    year = timezone.now().year
    number = _format_number(
        numbering.prefix, year, seq, numbering.number_length, numbering.reset_rule
    )
    numbering.next_number = seq + 1
    numbering.save(update_fields=["next_number", "updated_at"])
    return number
