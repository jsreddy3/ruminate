import logging
from typing import Dict, List, Any
from celery import Task
import httpx
import asyncio

from new_backend_ruminate.config import settings
from . import celery_app
from .video_pipeline.orchestrator import VideoPipeline

logger = logging.getLogger(__name__)


class VideoGenerationTask(Task):
    """
    Custom task class for video generation that manages the video pipeline instance.
    """
    def __init__(self):
        self.pipeline = None
    
    def __call__(self, *args, **kwargs):
        """Initialize pipeline on first call (lazy loading)."""
        if self.pipeline is None:
            logger.info("Initializing video pipeline...")
            self.pipeline = VideoPipeline()
        return self.run(*args, **kwargs)


@celery_app.task(
    bind=True,
    base=VideoGenerationTask,
    name='generate_video',
    max_retries=3,
    default_retry_delay=60,  # 1 minute
    retry_backoff=True,
    retry_jitter=True
)
def generate_video_task(
    self, 
    dream_id: str, 
    transcript: str, 
    segments: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Celery task that generates a video for a dream.
    
    Args:
        dream_id: UUID of the dream (as string)
        transcript: Full transcript text
        segments: List of segment data
        
    Returns:
        Dictionary with status and video_url
    """
    try:
        logger.info(f"Starting video generation for dream {dream_id}")
        
        # Update task state to show progress
        self.update_state(
            state='STARTED',
            meta={'current': 'Initializing video generation', 'total': 100}
        )
        
        # Generate video using the pipeline
        # The pipeline returns: (video_path, cost, metadata)
        video_path, cost, pipeline_metadata = await asyncio.to_thread(
            asyncio.run,
            self.pipeline.generate_video(transcript, dream_id)
        )
        
        # Upload to S3 and get URL
        # For now, we'll use the local path as a placeholder
        # In production, this would upload to S3 and return the S3 URL
        video_url = await _upload_video_to_s3(video_path, dream_id)
        
        # Combine metadata
        metadata = {
            **pipeline_metadata,
            "cost": cost,
            "local_path": str(video_path)
        }
        
        logger.info(f"Video generation completed for dream {dream_id}")
        
        # Send callback to API
        asyncio.run(_send_completion_callback(dream_id, video_url, metadata))
        
        return {
            "status": "completed",
            "video_url": video_url,
            "metadata": metadata
        }
        
    except Exception as e:
        logger.error(f"Video generation failed for dream {dream_id}: {str(e)}")
        
        # Retry if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying video generation for dream {dream_id} (attempt {self.request.retries + 1})")
            raise self.retry(exc=e)
        
        # If all retries exhausted, send failure callback
        asyncio.run(_send_failure_callback(dream_id, str(e)))
        
        raise


async def _upload_video_to_s3(video_path, dream_id: str) -> str:
    """
    Upload video to S3 and return the URL.
    
    TODO: Implement actual S3 upload using boto3
    """
    # Placeholder - in production this would:
    # 1. Upload the video file to S3
    # 2. Clean up the local file
    # 3. Return the S3 URL
    
    # For now, return a mock S3 URL
    return f"https://{settings().s3_bucket}.s3.{settings().aws_region}.amazonaws.com/videos/{dream_id}.mp4"


async def _send_completion_callback(dream_id: str, video_url: str, metadata: Dict[str, Any]):
    """Send completion callback to the API."""
    callback_url = f"{settings().api_base_url}/dreams/{dream_id}/video-complete"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                callback_url,
                json={
                    "video_url": video_url,
                    "metadata": metadata,
                    "status": "completed"
                },
                timeout=30
            )
            response.raise_for_status()
            logger.info(f"Successfully sent completion callback for dream {dream_id}")
    except Exception as e:
        logger.error(f"Failed to send completion callback for dream {dream_id}: {str(e)}")


async def _send_failure_callback(dream_id: str, error: str):
    """Send failure callback to the API."""
    callback_url = f"{settings().api_base_url}/dreams/{dream_id}/video-complete"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                callback_url,
                json={
                    "status": "failed",
                    "error": error
                },
                timeout=30
            )
            response.raise_for_status()
            logger.info(f"Successfully sent failure callback for dream {dream_id}")
    except Exception as e:
        logger.error(f"Failed to send failure callback for dream {dream_id}: {str(e)}")