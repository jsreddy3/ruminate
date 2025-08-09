# new_backend_ruminate/infrastructure/queue/redis_queue.py
from __future__ import annotations
import json
from typing import Any, Dict, Optional

import redis.asyncio as aioredis

from new_backend_ruminate.config import settings


class RedisProcessingQueue:
    def __init__(self, url: Optional[str] = None, queue_key: str = "processing:jobs") -> None:
        self._url = url or settings().redis_url
        self._client = aioredis.from_url(self._url, decode_responses=True)
        self._queue_key = queue_key

    async def enqueue(self, job: Dict[str, Any]) -> None:
        payload = json.dumps(job)
        await self._client.lpush(self._queue_key, payload)

    async def dequeue(self, timeout_seconds: int = 10) -> Optional[Dict[str, Any]]:
        # BRPOP returns (key, value) or None on timeout
        result = await self._client.brpop(self._queue_key, timeout=timeout_seconds)
        if not result:
            return None
        _, payload = result
        try:
            return json.loads(payload)
        except Exception:
            return None 