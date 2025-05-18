# new_backend_ruminate/infrastructure/llm/openai_llm.py

from __future__ import annotations
import os
from typing import AsyncGenerator, List

from openai import AsyncOpenAI

from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.domain.ports.llm import LLMService

class OpenAILLM(LLMService):
    """
    Minimal async wrapper around /v1/chat/completions with streaming=True.
    """

    def __init__(self, api_key: str | None = None, model: str = "gpt-4o") -> None:
        self._client: AsyncOpenAI = AsyncOpenAI(
            api_key=api_key or os.environ.get("OPENAI_API_KEY")
        )
        self._model = model

    async def _to_openai(self, msgs: List[Message]) -> list[dict[str, str]]:
        return [{"role": m.role, "content": m.content} for m in msgs]

    async def generate_response_stream(
        self, messages: List[Message]
    ) -> AsyncGenerator[str, None]:
        chat_msgs = await self._to_openai(messages)
        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=chat_msgs,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content
