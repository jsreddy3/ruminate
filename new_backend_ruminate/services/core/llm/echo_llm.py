from __future__ import annotations
from typing import AsyncGenerator, List

from new_backend_ruminate.domain.models.message import Message
from new_backend_ruminate.services.llm.base import LLMService


class EchoLLM(LLMService):
    async def generate_response_stream(
        self, messages: List[Message]
    ) -> AsyncGenerator[str, None]:
        user_text = messages[-1].content if messages else "(empty)"
        for token in user_text.split():
            yield token + " "
