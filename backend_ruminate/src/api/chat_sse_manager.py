import asyncio
import logging
from typing import Dict, AsyncGenerator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChatSSEManager:
    """Manages Server-Sent Event connections for chat message streams."""

    def __init__(self):
        # stream_id (typically ai_message_id) -> Queue
        self.streaming_queues: Dict[str, asyncio.Queue] = {}
        logger.info("ChatSSEManager initialized.")

    async def publish_chunk(self, stream_id: str, chunk_content: str):
        """Publish a chunk of content to a specific stream."""
        if stream_id not in self.streaming_queues:
            # Create the queue if a subscriber hasn't connected yet
            logger.info(f"Creating new SSE queue for stream_id: {stream_id}")
            self.streaming_queues[stream_id] = asyncio.Queue()
        
        # Format as SSE message
        sse_message = f"data: {chunk_content}\n\n"
        try:
            await self.streaming_queues[stream_id].put(sse_message)
            # logger.debug(f"Published chunk to stream {stream_id}") # Can be noisy
        except Exception as e:
            logger.error(f"Error publishing chunk to stream {stream_id}: {e}")

    async def subscribe_to_stream(self, stream_id: str) -> AsyncGenerator[str, None]:
        """Subscribe to a stream and yield messages as they arrive."""
        if stream_id not in self.streaming_queues:
            # Create the queue if the publisher hasn't sent anything yet
            logger.info(f"Subscriber connected, creating queue for stream_id: {stream_id}")
            self.streaming_queues[stream_id] = asyncio.Queue()
        else:
            logger.info(f"Subscriber connected to existing queue for stream_id: {stream_id}")

        queue = self.streaming_queues[stream_id]
        
        try:
            while True:
                chunk = await queue.get()
                # logger.debug(f"Dequeued chunk for stream {stream_id}") # Can be noisy
                yield chunk
                if chunk == "data: [DONE]\n\n": # Check for the end-of-stream message
                    logger.info(f"End-of-stream signal received for stream {stream_id}")
                    break
                queue.task_done()
        except asyncio.CancelledError:
            logger.info(f"Subscription cancelled for stream {stream_id}")
        except Exception as e:
            logger.error(f"Error during SSE subscription for stream {stream_id}: {e}", exc_info=True)
        finally:
            logger.info(f"Subscription ended for stream {stream_id}")
            # Optionally, we could clean up here, but cleanup_stream_queue is preferred
            # self.streaming_queues.pop(stream_id, None) 

    async def cleanup_stream_queue(self, stream_id: str):
        """Publish the end signal and remove the queue for a stream."""
        logger.info(f"Cleaning up stream queue for stream_id: {stream_id}")
        if stream_id in self.streaming_queues:
            try:
                # Signal the end of the stream to any active subscribers
                await self.publish_chunk(stream_id, "[DONE]")
                # Allow subscriber task to finish processing the [DONE] message
                await asyncio.sleep(0.1) 
            except Exception as e:
                logger.error(f"Error publishing [DONE] signal for stream {stream_id}: {e}")
            finally:
                # Remove the queue
                removed_queue = self.streaming_queues.pop(stream_id, None)
                if removed_queue:
                    logger.info(f"Removed queue for stream_id: {stream_id}")
                else:
                    logger.warning(f"Attempted to remove non-existent queue for stream_id: {stream_id}")
        else:
            logger.warning(f"Attempted to cleanup non-existent stream queue: {stream_id}")

# Singleton instance (consider using FastAPI dependency injection later)
chat_sse_manager = ChatSSEManager()
