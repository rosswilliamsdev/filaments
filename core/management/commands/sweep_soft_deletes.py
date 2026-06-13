"""
Railway cron — nightly.

Hard-deletes filaments that were soft-deleted more than PURGE_GRACE ago.
Cascade on the Filament FK removes ActionItems, FilamentTags, and FilamentLinks
automatically. S3 cleanup (audio/PDF source file) runs first; a failed S3
delete is logged but does not block the row deletion.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Filament

logger = logging.getLogger(__name__)

PURGE_GRACE = timedelta(days=30)


class Command(BaseCommand):
    help = "Hard-delete soft-deleted filaments beyond the 30-day grace window."

    def handle(self, *args, **options):
        cutoff = timezone.now() - PURGE_GRACE
        expired = list(
            Filament.objects.filter(deleted_at__lt=cutoff)
        )

        if not expired:
            self.stdout.write("sweep_soft_deletes: nothing to do")
            return

        deleted = s3_cleaned = s3_errors = 0

        for filament in expired:
            if filament.source_key and settings.USE_S3:
                try:
                    from core.s3 import delete_object
                    delete_object(filament.source_key)
                    s3_cleaned += 1
                except Exception:
                    logger.exception(
                        "sweep_soft_deletes: S3 delete failed for %s (key=%s)",
                        filament.pk,
                        filament.source_key,
                    )
                    s3_errors += 1

            filament.delete()
            logger.info("sweep_soft_deletes: purged filament %s (deleted_at=%s)", filament.pk, filament.deleted_at)
            deleted += 1

        self.stdout.write(
            f"sweep_soft_deletes: {deleted} purged"
            f", {s3_cleaned} S3 objects removed, {s3_errors} S3 errors"
        )
