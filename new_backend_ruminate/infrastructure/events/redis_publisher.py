# new_backend_ruminate/infrastructure/events/redis_publisher.py
from __future__ import annotations
import asyncio
from typing import AsyncIterator

import redis.asyncio as aioredis

from new_backend_ruminate.config import settings


class RedisEventPublisher:
    def __init__(self, url: str | None = None) -> None:
        self._url = url or settings().redis_url
        # Single shared client for pub/sub (redis-py handles async)
        self._client = aioredis.from_url(self._url, decode_responses=True)

    async def publish(self, stream_id: str, chunk: str) -> None:
        # Use pub/sub channels keyed by stream_id
        await self._client.publish(stream_id, chunk)

    async def subscribe(self, stream_id: str) -> AsyncIterator[str]:
        pubsub = self._client.pubsub()
        await pubsub.subscribe(stream_id)
        try:
            async for message in pubsub.listen():
                if message is None:
                    continue
                if message.get("type") != "message":
                    continue
                data = message.get("data")
                if data is None:
                    continue
                yield data
        finally:
            await pubsub.unsubscribe(stream_id)
            await pubsub.close() 