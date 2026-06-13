"""
Railway cron — every 15–30 min.

Finds filaments stuck in 'processing' longer than STUCK_THRESHOLD and either
re-enqueues the pipeline (if under MAX_ATTEMPTS) or marks them failed.

Re-enqueueing is safe: the pipeline is persist-and-resume — each task skips
steps whose output already exists, so the chain continues from the last
successful step rather than starting over.
"""

import logging
from datetime import timedelta

from celery.exceptions import OperationalError
from django.core.management.base import BaseCommand
from django.db.models import F
from django.utils import timezone

from core.models import Filament
from core.tasks import process_filament

logger = logging.getLogger(__name__)

STUCK_THRESHOLD = timedelta(minutes=30)
MAX_ATTEMPTS = 3


class Command(BaseCommand):
    help = "Re-enqueue or fail filaments stuck in the processing state."

    def handle(self, *args, **options):
        cutoff = timezone.now() - STUCK_THRESHOLD
        stuck = list(
            Filament.objects.filter(
                status=Filament.Status.PROCESSING,
                updated_at__lt=cutoff,
                deleted_at__isnull=True,
            )
        )

        if not stuck:
            self.stdout.write("sweep_stuck: nothing to do")
            return

        requeued = failed = errors = 0

        for filament in stuck:
            if filament.pipeline_attempts >= MAX_ATTEMPTS:
                Filament.objects.filter(pk=filament.pk).update(
                    status=Filament.Status.FAILED,
                    updated_at=timezone.now(),
                )
                logger.warning(
                    "sweep_stuck: filament %s exceeded max attempts (%d) → failed",
                    filament.pk,
                    MAX_ATTEMPTS,
                )
                failed += 1
            else:
                try:
                    # Bump attempts + updated_at before enqueueing so this
                    # filament isn't re-picked by the very next sweep run.
                    Filament.objects.filter(pk=filament.pk).update(
                        pipeline_attempts=F("pipeline_attempts") + 1,
                        updated_at=timezone.now(),
                    )
                    process_filament.delay(str(filament.pk))
                    logger.info(
                        "sweep_stuck: requeued filament %s (attempt %d)",
                        filament.pk,
                        filament.pipeline_attempts + 1,
                    )
                    requeued += 1
                except OperationalError:
                    logger.exception(
                        "sweep_stuck: broker unavailable, could not requeue %s",
                        filament.pk,
                    )
                    errors += 1

        self.stdout.write(
            f"sweep_stuck: {requeued} requeued, {failed} failed, {errors} errors"
            f" (of {len(stuck)} stuck)"
        )
