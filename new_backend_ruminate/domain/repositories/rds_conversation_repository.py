# new_backend/infrastructure/repositories/rds_conversation_repository.py
from __future__ import annotations
from typing import List, Optional

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.models.conversation import Conversation
from new_backend_ruminate.domain.models.message import Message
from new_backend_ruminate.domain.repositories.conversation_repository import ConversationRepository


class RDSConversationRepository(ConversationRepository):
    async def create(self, conv: Conversation, session: AsyncSession) -> Conversation:
        session.add(conv)
        await session.flush()
        return conv

    async def get(self, cid: str, session: AsyncSession) -> Optional[Conversation]:
        return await session.get(Conversation, cid)

    async def add_message(self, msg: Message, session: AsyncSession) -> None:
        session.add(msg)
        await session.flush()

    async def latest_thread(self, cid: str, session: AsyncSession) -> List[Message]:
        sql = text(
            """
            WITH RECURSIVE thread AS (
              SELECT *
              FROM messages
              WHERE conversation_id = :cid
                AND parent_id IS NULL
              UNION ALL
              SELECT DISTINCT ON (m.parent_id) m.*
              FROM messages m
              JOIN thread t ON t.id = m.parent_id
              WHERE m.conversation_id = :cid
              ORDER BY m.parent_id, m.version DESC
            )
            SELECT * FROM thread;
            """
        )
        rows = (await session.execute(sql, {"cid": cid})).mappings().all()
        return [Message(**r) for r in rows]

    async def full_tree(self, cid: str, session: AsyncSession) -> List[Message]:
        stmt = select(Message).where(Message.conversation_id == cid)
        return list((await session.scalars(stmt)).all())

    async def edit_message(
        self, msg_id: str, new_content: str, session: AsyncSession
    ) -> tuple[Message, str]:
        original: Message = await session.get(Message, msg_id)
        if original is None:
            raise ValueError(f"message {msg_id} not found")

        sibling_version = original.version + 1
        sibling = Message(
            conversation_id=original.conversation_id,
            parent_id=original.parent_id,
            version=sibling_version,
            role=original.role,
            content=new_content,
        )
        session.add(sibling)
        await session.flush()
        return sibling, sibling.id
