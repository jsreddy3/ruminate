# new_backend_ruminate/services/conversation_service.py
from __future__ import annotations
from typing import List, Tuple
from uuid import uuid4

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.models.message import Message, Role
from new_backend_ruminate.domain.repositories.conversation_repository import (
    ConversationRepository,
)
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.services.llm.base import LLMService
from new_backend_ruminate.infrastructure.db.bootstrap import session_scope


class ConversationService:
    """Pure business logic: no Pydantic, no FastAPI, no DB-bootstrap."""

    def __init__(
        self,
        repo: ConversationRepository,
        llm: LLMService,
        hub: EventStreamHub,
    ) -> None:
        self._repo = repo
        self._llm = llm
        self._hub = hub

    # ─────────────────────────────── helpers ──────────────────────────────── #

    async def _publish_stream(
        self, ai_id: str, context: List[Message]) -> None:
        full = ""
        async for chunk in self._llm.generate_response_stream(context):
            full += chunk
            await self._hub.publish(ai_id, chunk)
        await self._hub.terminate(ai_id)

        async with session_scope() as session:
            await self._repo.update_message_content(ai_id, full, session)

    # ───────────────────────────── public API ─────────────────────────────── #

    async def send_message(
        self,
        *,
        background: BackgroundTasks,
        conv_id: str,
        user_content: str,
        parent_id: str | None,
    ) -> Tuple[str, str]:
        """
        Standard user turn: write user + placeholder, extend active thread,
        commit, then stream.
        Returns (user_msg_id, ai_msg_id).
        """

        async with session_scope() as session:
            # -------- 1  write user turn --------
            user = Message(
                id=str(uuid4()),
                conversation_id=conv_id,
                parent_id=parent_id,
                version=1,
                role=Role.USER,
                content=user_content,
            )
            await self._repo.add_message(user, session)
            if parent_id:
                await self._repo.set_active_child(parent_id, user.id, session)

            # -------- 2  write assistant placeholder --------
            ai_id = str(uuid4())
            placeholder = Message(
                id=ai_id,
                conversation_id=conv_id,
                parent_id=user.id,
                version=1,
                role=Role.ASSISTANT,
                content="",
            )
            await self._repo.add_message(placeholder, session)
            if parent_id:
                await self._repo.set_active_child(user.id, ai_id, session)

            # -------- 3  update active thread --------
            thread = await self._repo.latest_thread(conv_id, session)
            thread_ids = [m.id for m in thread] + [user.id, ai_id]
            await self._repo.update_active_thread(conv_id, thread_ids, session)

        # -------- 4  background stream --------
        background.add_task(self._publish_stream, ai_id, thread + [user])

        return user.id, ai_id

    async def edit_message_streaming(
        self,
        *,
        background: BackgroundTasks,
        conv_id: str,
        msg_id: str,
        new_content: str,
    ) -> Tuple[str, str]:
        """
        Creates a sibling version of `msg_id`, attaches new assistant placeholder,
        flips parent pointer, updates thread, then streams.
        Returns (edited_user_id, ai_placeholder_id).
        """
        async with session_scope() as session:
            # 1 ─ sibling user turn
            sibling, sibling_id = await self._repo.edit_message(msg_id, new_content, session)

            # 2 ─ assistant placeholder
            ai_id = str(uuid4())
            placeholder = Message(
                id=ai_id,
                conversation_id=conv_id,
                parent_id=sibling_id,
                version=1,
                role=Role.ASSISTANT,
                content="",
            )
            await self._repo.add_message(placeholder, session)

            # 3 ─ rebuild thread up to parent + new branch
            prior = await self._repo.latest_thread(conv_id, session)
            try:
                cut = [m.id for m in prior].index(sibling.parent_id) + 1
            except ValueError:  # parent not on active path (edge-case)
                cut = len(prior)
            new_thread = [m.id for m in prior[:cut]] + [sibling_id, ai_id]
            await self._repo.update_active_thread(conv_id, new_thread, session)

        # 4 ─ background stream
        background.add_task(self._publish_stream, ai_id, prior[:cut] + [sibling])

        return sibling_id, ai_id

    # simple pass-through reads
    async def get_latest_thread(self, cid: str, session: AsyncSession) -> List[Message]:
        return await self._repo.latest_thread(cid, session)

    async def get_full_tree(self, cid: str, session: AsyncSession) -> List[Message]:
        return await self._repo.full_tree(cid, session)

    async def get_versions(self, mid: str, session: AsyncSession) -> List[Message]:
        return await self._repo.message_versions(mid, session)

    async def get_conversation(self, cid: str, session: AsyncSession):
        return await self._repo.get(cid, session)
