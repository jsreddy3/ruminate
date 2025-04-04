import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, Any

logger = logging.getLogger(__name__)

# In-memory storage for active SSE queues per document_id
# Use defaultdict to simplify queue creation
STREAMING_QUEUES: Dict[str, asyncio.Queue] = defaultdict(asyncio.Queue)

async def publish_status(document_id: str, status_update: Dict[str, Any]):
    """Put a status update into the queue for a specific document."""
    if document_id in STREAMING_QUEUES:
        try:
            # Convert dict to JSON string for SSE
            message = f"data: {json.dumps(status_update)}\n\n"
            await STREAMING_QUEUES[document_id].put(message)
            logger.debug(f"Published status for {document_id}: {status_update}")
        except Exception as e:
            logger.error(f"Error publishing status for {document_id}: {e}")
    else:
        # This might happen if the background task finishes before the client connects
        logger.warning(f"No active SSE queue found for document_id: {document_id} when publishing {status_update}")


async def subscribe_to_updates(document_id: str):
    """Yield status updates for a specific document."""
    # Ensure the queue exists when a client subscribes
    queue = STREAMING_QUEUES[document_id]
    logger.info(f"SSE client subscribed for document_id: {document_id}")
    try:
        while True:
            # Wait for a message from the background task
            message = await queue.get()
            if message is None:  # Use None as a signal to stop
                logger.debug(f"SSE stream closing for document_id: {document_id} (None received)")
                break
            yield message
            queue.task_done()
    except asyncio.CancelledError:
        logger.info(f"SSE client disconnected for document_id: {document_id}")
    finally:
        # Clean up the queue when the client disconnects or the stream ends
        # Be careful with multiple clients - maybe use reference counting later
        if document_id in STREAMING_QUEUES:
            # Check if queue is empty before deleting, might cause issues if publisher still active
            # A better approach might be needed for production (e.g., timeout based cleanup)
            # For now, let's signal the publisher if it's still waiting
            try:
                await STREAMING_QUEUES[document_id].put(None) # Signal any remaining publisher
            except Exception:
                pass # Ignore if queue is closed/full etc.
            # Consider removing the queue only after ensuring the background task is done
            # del STREAMING_QUEUES[document_id]
            # logger.info(f"Removed SSE queue for document_id: {document_id}")
            pass # Let's not delete it for now to avoid race conditions

async def cleanup_queue(document_id: str):
    """Signal the end and potentially remove the queue after processing."""
    if document_id in STREAMING_QUEUES:
        try:
            await STREAMING_QUEUES[document_id].put(None) # Signal end to subscribers
            logger.info(f"Signaled end of stream for document_id: {document_id}")
            # Optional: remove queue here if sure no more subscribers/publishers
            # Consider delay or reference counting before deleting
            # del STREAMING_QUEUES[document_id]
        except Exception as e:
            logger.error(f"Error during cleanup for queue {document_id}: {e}")
