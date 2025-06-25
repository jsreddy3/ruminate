"""Video generation service that queues video creation jobs."""
import logging
from datetime import datetime
from uuid import UUID

from new_backend_ruminate.dependencies import get_session
from new_backend_ruminate.domain.dream.entities.dream import VideoStatus
from new_backend_ruminate.infrastructure.implementations.rds_dream_repository import RDSDreamRepository
from new_backend_ruminate.infrastructure.celery.adapter import CeleryVideoQueueAdapter

logger = logging.getLogger(__name__)


async def create_video(dream_id: UUID):
    """
    Queue a video generation job for the given dream.
    
    This function:
    1. Retrieves the dream and its transcript
    2. Queues the video generation job
    3. Updates the dream with the job ID and status
    """
    try:
        async with get_session() as session:
            # Get dream repository
            dream_repo = RDSDreamRepository(session)
            
            # Fetch the dream
            dream = await dream_repo.get_by_id(dream_id)
            if not dream:
                logger.error(f"Dream {dream_id} not found")
                return
            
            # Check if video generation is already in progress
            if dream.video_status in [VideoStatus.QUEUED, VideoStatus.PROCESSING]:
                logger.warning(f"Video generation already in progress for dream {dream_id}")
                return
            
            # Get transcript and segments
            transcript = dream.transcript or ""
            segments = [
                {
                    "order": s.order,
                    "transcript": s.transcript,
                    "s3_key": s.s3_key,
                }
                for s in dream.segments
            ]
            
            # Queue the video generation job
            video_queue = CeleryVideoQueueAdapter()
            job_id = await video_queue.enqueue_video_generation(
                dream_id=dream_id,
                transcript=transcript,
                segments=segments
            )
            
            # Update dream with job information
            dream.video_job_id = job_id
            dream.video_status = VideoStatus.QUEUED
            dream.video_started_at = datetime.utcnow()
            
            await session.commit()
            
            logger.info(f"Queued video generation job {job_id} for dream {dream_id}")
            
    except Exception as e:
        logger.error(f"Failed to queue video generation for dream {dream_id}: {str(e)}")
        raise
