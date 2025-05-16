# new_backend/services/chat_service.py
from __future__ import annotations
from uuid import uuid4
from typing import List

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.conversation.repo import ConversationRepository
from new_backend_ruminate.services.core.llm.base import LLMService
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub


class ChatService:
    def __init__(
        self,
        repo: ConversationRepository,
        llm: LLMService,
        sse: EventStreamHub,
    ):
        self._repo = repo
        self._llm = llm
        self._sse = sse

    async def send_message(
        self,
        *,
        session: AsyncSession,
        background: BackgroundTasks,
        conv_id: str,
        user_content: str,
        parent_id: str,
    ) -> tuple[str, str]:
        user_msg = Message(
            id=str(uuid4()),
            conversation_id=conv_id,
            parent_id=parent_id,
            version=1,
            role=Role.USER,
            content=user_content,
        )
        await self._repo.add_message(user_msg, session)

        ai_id = str(uuid4())
        placeholder = Message(
            id=ai_id,
            conversation_id=conv_id,
            parent_id=user_msg.id,
            version=1,
            role=Role.ASSISTANT,
            content="",
        )
        await self._repo.add_message(placeholder, session)

        background.add_task(
            self._stream_llm,
            ai_id,
            [user_msg],
        )
        return user_msg.id, ai_id

    async def _stream_llm(self, ai_id: str, context: List[Message]) -> None:
        async for chunk in self._llm.generate_response_stream(context):
            await self._sse.publish(ai_id, chunk)
        await self._sse.terminate(ai_id)
