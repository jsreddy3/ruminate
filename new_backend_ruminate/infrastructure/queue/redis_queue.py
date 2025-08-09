# new_backend_ruminate/infrastructure/queue/redis_queue.py
from __future__ import annotations
import json
from typing import Any, Dict, Optional

import redis.asyncio as aioredis
import socket
from urllib.parse import urlparse

from new_backend_ruminate.config import settings


class RedisProcessingQueue:
    def __init__(self, url: Optional[str] = None, queue_key: str = "processing:jobs") -> None:
        self._url = url or settings().redis_url
        self._queue_key = queue_key
        self._client = self._build_client(self._url)

    def _build_client(self, url: str):
        # Prefer IPv6 if hostname has only AAAA record
        parsed = urlparse(url)
        scheme = parsed.scheme
        host = parsed.hostname
        port = parsed.port or 6379
        username = parsed.username or None
        password = parsed.password or None
        use_ssl = scheme == 'rediss'

        ipv6_addr = None
        try:
            infos = socket.getaddrinfo(host, port, socket.AF_INET6, socket.SOCK_STREAM)
            if infos:
                ipv6_addr = infos[0][4][0]
        except Exception:
            ipv6_addr = None
        if ipv6_addr:
            return aioredis.Redis(
                host=ipv6_addr,
                port=port,
                username=username,
                password=password,
                ssl=use_ssl,
                decode_responses=True,
            )
        # Fallback to URL if IPv6 resolution not available
        return aioredis.from_url(url, decode_responses=True)

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