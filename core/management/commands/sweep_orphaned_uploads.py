"""
Railway cron — nightly.

Deletes filaments that were created but never had their upload confirmed — i.e.
they stayed in 'pending_upload' longer than ORPHAN_THRESHOLD. This covers
abandoned upload sessions (app crashed, network dropped, upload never finished).

S3 cleanup runs first; if it fails the row is still deleted (a stray S3 object
is preferable to a zombie DB row that never gets cleaned up).
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Filament

logger = logging.getLogger(__name__)

ORPHAN_THRESHOLD = timedelta(hours=24)


class Command(BaseCommand):
    help = "Hard-delete filaments stuck in pending_upload beyond the orphan window."

    def handle(self, *args, **options):
        cutoff = timezone.now() - ORPHAN_THRESHOLD
        orphans = list(
            Filament.objects.filter(
                status=Filament.Status.PENDING_UPLOAD,
                created_at__lt=cutoff,
                deleted_at__isnull=True,
            )
        )

        if not orphans:
            self.stdout.write("sweep_orphaned_uploads: nothing to do")
            return

        deleted = s3_cleaned = s3_errors = 0

        for filament in orphans:
            if filament.source_key and settings.USE_S3:
                try:
                    from core.s3 import delete_object
                    delete_object(filament.source_key)
                    s3_cleaned += 1
                except Exception:
                    logger.exception(
                        "sweep_orphaned_uploads: S3 delete failed for %s (key=%s)",
                        filament.pk,
                        filament.source_key,
                    )
                    s3_errors += 1

            filament.delete()
            logger.info("sweep_orphaned_uploads: deleted orphaned filament %s", filament.pk)
            deleted += 1

        self.stdout.write(
            f"sweep_orphaned_uploads: {deleted} deleted"
            f", {s3_cleaned} S3 objects removed, {s3_errors} S3 errors"
        )
