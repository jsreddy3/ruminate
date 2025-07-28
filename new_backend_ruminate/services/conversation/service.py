# new_backend_ruminate/services/conversation/service.py
from __future__ import annotations
from typing import List, Tuple, Any
from uuid import uuid4

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.conversation.repo import (
    ConversationRepository,
)
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.domain.ports.llm import LLMService
from new_backend_ruminate.infrastructure.db.bootstrap import session_scope
from new_backend_ruminate.context.builder import ContextBuilder
from new_backend_ruminate.context.prompts import agent_system_prompt, default_system_prompts
from new_backend_ruminate.domain.ports.tool import tool_registry

class ConversationService:
    """Pure business logic: no Pydantic, no FastAPI, no DB-bootstrap."""

    def __init__(
        self,
        repo: ConversationRepository,
        llm: LLMService,
        hub: EventStreamHub,
        ctx_builder: ContextBuilder,
    ) -> None:
        self._repo = repo
        self._llm = llm
        self._hub = hub
        self._ctx_builder = ctx_builder

    # ─────────────────────────────── helpers ──────────────────────────────── #

    async def _publish_stream(self, ai_id: str, prompt: List[dict[str, str]]) -> None:
        full = ""
        async for chunk in self._llm.generate_response_stream(prompt):
            full += chunk
            await self._hub.publish(ai_id, chunk)
        
        # Send completion signal that frontend expects
        await self._hub.publish(ai_id, "[DONE]")
        await self._hub.terminate(ai_id)

        async with session_scope() as session:
            await self._repo.update_message_content(ai_id, full, session)


    # ───────────────────────────── public API ─────────────────────────────── #

    async def create_conversation(
        self,
        *,
        user_id: str,
        conv_type: str = "chat",
        meta: dict[str, Any] | None = None,
        document_id: str | None = None,
        source_block_id: str | None = None,
        selected_text: str | None = None,
        text_start_offset: int | None = None,
        text_end_offset: int | None = None,
    ) -> tuple[str, str]:
        async with session_scope() as session:
            # Create conversation with appropriate fields
            conv = Conversation(
                user_id=user_id,
                type=conv_type.upper(), 
                meta_data=meta or {},
                document_id=document_id,
                source_block_id=source_block_id,
                selected_text=selected_text,
                text_start_offset=text_start_offset,
                text_end_offset=text_end_offset
            )
            await self._repo.create(conv, session)

            # Select appropriate system prompt
            if conv_type == "agent":
                sys_text = agent_system_prompt(list(tool_registry.values()))
            else:
                sys_text = default_system_prompts.get(conv_type, default_system_prompts["chat"])

            root = Message(
                conversation_id=conv.id,
                role=Role.SYSTEM,
                content=sys_text,
                version=0,
            )
            await self._repo.add_message(root, session)

            await self._repo.update_active_thread(conv.id, [root.id], session)
            conv.root_message_id = root.id

        return conv.id, root.id


    async def send_message(
        self,
        *,
        background: BackgroundTasks,
        conv_id: str,
        user_content: str,
        parent_id: str | None,
        user_id: str,
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
                version=0,
                role=Role.USER,
                content=user_content,
                user_id=user_id,
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
                version=0,
                role=Role.ASSISTANT,
                content="",
                user_id=user_id,
            )
            await self._repo.add_message(placeholder, session)
            if parent_id:
                await self._repo.set_active_child(user.id, ai_id, session)

            # -------- 3  update active thread --------
            thread = await self._repo.latest_thread(conv_id, session)
            thread_ids = [m.id for m in thread] + [user.id, ai_id]
            await self._repo.update_active_thread(conv_id, thread_ids, session)
            convo = await self._repo.get(conv_id, session)
            prompt = await self._ctx_builder.build(convo, thread + [user], session=session)

        # -------- 4  background stream --------
        background.add_task(self._publish_stream, ai_id, prompt)

        return user.id, ai_id

    async def edit_message_streaming(
        self,
        *,
        background: BackgroundTasks,
        conv_id: str,
        msg_id: str,
        new_content: str,
        user_id: str,
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
                version=0,
                role=Role.ASSISTANT,
                content="",
                user_id=user_id,
            )
            await self._repo.add_message(placeholder, session)
            await self._repo.set_active_child(sibling_id, ai_id, session)

            # 3 ─ rebuild thread up to parent + new branch
            prior = await self._repo.latest_thread(conv_id, session)
            try:
                cut = [m.id for m in prior].index(sibling.parent_id) + 1
            except ValueError:  # parent not on active path (edge-case)
                cut = len(prior)
            new_thread = [m.id for m in prior[:cut]] + [sibling_id, ai_id]
            await self._repo.update_active_thread(conv_id, new_thread, session)
            convo = await self._repo.get(conv_id, session)
            prompt = await self._ctx_builder.build(convo, prior[:cut] + [sibling], session=session)

        # 4 ─ background stream
        background.add_task(self._publish_stream, ai_id, prompt)

        return sibling_id, ai_id

    # simple pass-through reads
    async def get_latest_thread(self, cid: str, user_id: str, session: AsyncSession) -> List[Message]:
        return await self._repo.latest_thread(cid, session)

    async def get_full_tree(self, cid: str, user_id: str, session: AsyncSession) -> List[Message]:
        return await self._repo.full_tree(cid, session)

    async def get_versions(self, mid: str, user_id: str, session: AsyncSession) -> List[Message]:
        # Verify message exists
        message = await self._repo.get_message(mid, session)
        if not message:
            raise ValueError("Message not found")
        
        return await self._repo.message_versions(mid, session)

    async def get_conversation(self, cid: str, user_id: str, session: AsyncSession):
        conv = await self._repo.get(cid, session)
        if not conv or conv.user_id != user_id:
            raise PermissionError("Access denied: You don't own this conversation")
        return conv
    
    async def get_conversations_by_criteria(self, criteria: dict, user_id: str, session: AsyncSession) -> List[Conversation]:
        # Add user_id to criteria to only return user's conversations
        criteria["user_id"] = user_id
        return await self._repo.get_conversations_by_criteria(criteria, session)
