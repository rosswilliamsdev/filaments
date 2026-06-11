import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def process_filament(filament_id: str) -> None:
    """
    Pipeline entry point: transcribe/extract → summarize + key ideas + action
    items → tags → embedding → auto-link (backend-planning-doc.md → Business
    Logic). Each step must be idempotent and persist as it completes so a
    retry resumes rather than restarting.

    Not implemented yet — enqueued rows stay in 'processing' until the
    pipeline phase lands.
    """
    logger.warning(
        "process_filament(%s): pipeline not implemented yet — row stays in 'processing'",
        filament_id,
    )
