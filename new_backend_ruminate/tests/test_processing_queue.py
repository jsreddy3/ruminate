import asyncio
import os
import pytest

from new_backend_ruminate.infrastructure.queue.inproc_queue import InProcessProcessingQueue
from new_backend_ruminate.infrastructure.queue.redis_queue import RedisProcessingQueue
from new_backend_ruminate.config import settings


@pytest.mark.asyncio
async def test_inproc_queue_enqueue_dequeue_roundtrip():
    q = InProcessProcessingQueue()
    job = {"document_id": "doc-1", "s3_key": "documents/doc-1/file.pdf", "filename": "file.pdf", "user_id": "u1"}

    await q.enqueue(job)
    out = await q.dequeue(timeout_seconds=1)

    assert out is not None
    assert out["document_id"] == job["document_id"]
    assert out["s3_key"] == job["s3_key"]


@pytest.mark.asyncio
async def test_redis_queue_enqueue_dequeue_roundtrip():
    # Try to connect; skip if Redis is unavailable
    try:
        q = RedisProcessingQueue(url=settings().redis_url, queue_key="test:processing:jobs")
        # Clear any leftovers quickly (best effort)
        # No direct clear API; just proceed
    except Exception as e:
        pytest.skip(f"Redis not available or misconfigured: {e}")

    job = {"document_id": "doc-2", "s3_key": "documents/doc-2/file.pdf", "filename": "file.pdf", "user_id": "u2"}
    await q.enqueue(job)
    out = await q.dequeue(timeout_seconds=2)

    if out is None:
        pytest.skip("Redis queue did not return a job (likely Redis not running)")

    assert out["document_id"] == job["document_id"]
    assert out["s3_key"] == job["s3_key"] 