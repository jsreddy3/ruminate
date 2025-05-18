# tests/stubs.py
from typing import AsyncGenerator, List
from new_backend_ruminate.domain.ports.llm import LLMService
from new_backend_ruminate.domain.conversation.entities.message import Message
import logging
from new_backend_ruminate.context.builder import ContextBuilder
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict

logger = logging.getLogger(__name__)


class StubLLM(LLMService):
    async def generate_response_stream(
        self, messages: List[Message]
    ) -> AsyncGenerator[str, None]:
        # deterministic two-chunk answer
        logger.debug("stub_stream %s", messages)
        yield "foo "
        yield "bar"

class StubContextBuilder(ContextBuilder):
    """Returns a fixed prompt so we can assert it reached the LLM."""
    def __init__(self) -> None:
        self.last_prompt: List[Dict[str, str]] | None = None

    async def build(
        self,
        conv: Conversation,
        thread: List[Message],
        *,
        session: AsyncSession,
    ) -> List[Dict[str, str]]:
        self.last_prompt = [
            {"role": "system", "content": "stub system"},
            {"role": "user", "content": "stub user"},
        ]
        return self.last_prompt