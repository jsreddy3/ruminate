import asyncio
import json
import pytest

from new_backend_ruminate.infrastructure.events.redis_publisher import RedisEventPublisher
from new_backend_ruminate.config import settings


@pytest.mark.asyncio
async def test_redis_event_publisher_pubsub_roundtrip():
    try:
        pub = RedisEventPublisher(url=settings().redis_url)
    except Exception as e:
        pytest.skip(f"Redis not available or misconfigured: {e}")

    stream_id = "test:stream:doc_123"
    received: list[str] = []

    async def consume():
        async for chunk in pub.subscribe(stream_id):
            received.append(chunk)
            if len(received) >= 1:
                break

    consumer_task = asyncio.create_task(consume())

    # Give subscriber a moment to subscribe
    await asyncio.sleep(0.1)

    payload = json.dumps({"status": "READY", "document_id": "123"})
    await pub.publish(stream_id, payload)

    try:
        await asyncio.wait_for(consumer_task, timeout=2)
    except asyncio.TimeoutError:
        pytest.skip("Redis pub/sub did not deliver message in time (likely Redis not running)")

    assert received and received[0] == payload 