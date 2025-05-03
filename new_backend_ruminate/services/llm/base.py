from __future__ import annotations
from abc import ABC, abstractmethod
from typing import AsyncGenerator, List

from new_backend_ruminate.domain.models.message import Message


class LLMService(ABC):
    """Business-logic layer talks only to this abstract base."""

    @abstractmethod
    async def generate_response_stream(
        self, messages: List[Message]
    ) -> AsyncGenerator[str, None]: ...

    async def generate_response(self, messages: List[Message]) -> str:
        """Fallback convenience: consume the stream and join the chunks."""
        chunks: List[str] = []
        async for c in self.generate_response_stream(messages):
            chunks.append(c)
        return "".join(chunks)

    # optional: embeddings for retrieval-augmented tasks
    async def get_embedding(self, text: str) -> List[float]:  # pragma: no cover
        raise NotImplementedError
