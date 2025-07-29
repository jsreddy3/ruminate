from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Dict, List, Union

from new_backend_ruminate.domain.conversation.entities.message import Message


class LLMService(ABC):

    @abstractmethod
    async def generate_response_stream(
        self, messages: List[Message], model: str | None = None
    ) -> AsyncGenerator[str, None]:
        ...

    async def generate_response(self, messages: List[Message], model: str | None = None) -> str:
        buf: List[str] = []
        async for chunk in self.generate_response_stream(messages, model):
            buf.append(chunk)
        return "".join(buf)

    @abstractmethod
    async def generate_structured_response(
        self,
        messages: List[Union[Message, Dict[str, str]]],
        *,
        response_format: Dict[str, Any],
        json_schema: Dict[str, Any] | None = None,
        model: str | None = None,
    ) -> Dict[str, Any]:
        ...

    async def get_embedding(self, text: str) -> List[float]:   # pragma: no cover
        raise NotImplementedError
