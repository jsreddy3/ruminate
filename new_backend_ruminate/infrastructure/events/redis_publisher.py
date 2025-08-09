# new_backend_ruminate/infrastructure/events/redis_publisher.py
from __future__ import annotations
import asyncio
from typing import AsyncIterator

import redis.asyncio as aioredis
import socket
from urllib.parse import urlparse

from new_backend_ruminate.config import settings


class RedisEventPublisher:
    def __init__(self, url: str | None = None) -> None:
        self._url = url or settings().redis_url
        self._client = self._build_client(self._url)

    def _build_client(self, url: str):
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
        return aioredis.from_url(url, decode_responses=True)

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