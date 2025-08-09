# new_backend_ruminate/infrastructure/queue/inproc_queue.py
from __future__ import annotations
import asyncio
import json
from typing import Any, Dict, Optional


class InProcessProcessingQueue:
    def __init__(self) -> None:
        self._q: asyncio.Queue[str] = asyncio.Queue(maxsize=1024)

    async def enqueue(self, job: Dict[str, Any]) -> None:
        await self._q.put(json.dumps(job))

    async def dequeue(self, timeout_seconds: int = 10) -> Optional[Dict[str, Any]]:
        try:
            payload = await asyncio.wait_for(self._q.get(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            return None
        try:
            return json.loads(payload)
        except Exception:
            return None 