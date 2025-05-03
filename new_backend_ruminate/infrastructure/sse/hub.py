# new_backend_ruminate/infrastructure/sse/hub.py

import asyncio
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict, List


class EventStreamHub:
    """
    In-process publish/subscribe hub.  Multiple consumers per stream are
    supported by maintaining a list[Queue] for each stream_id.
    """

    def __init__(self) -> None:
        self._queues: Dict[str, List[asyncio.Queue[str]]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def register_consumer(self, stream_id: str) -> AsyncIterator[str]:
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._queues[stream_id].append(q)

        try:
            while True:
                chunk = await q.get()
                if chunk is None:                           # termination sentinel
                    return
                yield chunk
        finally:                                           # auto-cleanup
            async with self._lock:
                self._queues[stream_id].remove(q)
                if not self._queues[stream_id]:
                    self._queues.pop(stream_id, None)

    async def publish(self, stream_id: str, chunk: str) -> None:
        async with self._lock:
            for q in self._queues.get(stream_id, []):
                await q.put(chunk)

    async def terminate(self, stream_id: str) -> None:
        async with self._lock:
            for q in self._queues.pop(stream_id, []):
                await q.put(None)
