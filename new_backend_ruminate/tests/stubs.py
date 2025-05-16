from typing import AsyncGenerator, List
from new_backend_ruminate.services.core.llm.base import LLMService
from new_backend_ruminate.domain.conversation.entities.message import Message
import logging

logger = logging.getLogger(__name__)


class StubLLM(LLMService):
    async def generate_response_stream(
        self, messages: List[Message]
    ) -> AsyncGenerator[str, None]:
        # deterministic two-chunk answer
        logger.debug("stub_stream %s", messages)
        yield "foo "
        yield "bar"
