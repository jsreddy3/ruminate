# new_backend_ruminate/infrastructure/repositories/rds_conversation_repository.py
from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import (
    select,
    update,
    text,
)
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.models.conversation import Conversation
from new_backend_ruminate.domain.models.message import Message
from new_backend_ruminate.domain.repositories.conversation_repository import (
    ConversationRepository,
)


class RDSConversationRepository(ConversationRepository):
    # ─────────────────────────────── creation / reads ───────────────────────────── #

    async def create(self, conv: Conversation, session: AsyncSession) -> Conversation:
        session.add(conv)
        await session.flush()               # let PKs materialise
        return conv

    async def get(self, cid: str, session: AsyncSession) -> Optional[Conversation]:
        return await session.get(Conversation, cid)

    async def latest_thread(self, cid: str, session: AsyncSession) -> List[Message]:
        """
        Depth-first walk that always picks the **highest-version** sibling
        at each parent; O(depth) thanks to a deterministic DISTINCT ON.
        """
        sql = text(
            """
            WITH RECURSIVE thread AS (
              SELECT *
              FROM   messages
              WHERE  conversation_id = :cid
              AND    parent_id IS NULL

              UNION ALL

              SELECT m.*
              FROM   messages m
              JOIN   thread t ON t.active_child_id = m.id 
              WHERE  m.conversation_id = :cid

              UNION ALL

              SELECT DISTINCT ON (m.parent_id) m.*
              FROM   messages m
              JOIN   thread t ON t.id = m.parent_id
              WHERE  m.conversation_id = :cid
              AND    t.active_child_id IS NULL
              ORDER  BY m.parent_id, m.version DESC
            )
            SELECT *
            FROM   thread
            ORDER  BY created_at;
            """
        )
        rows = (await session.execute(sql, {"cid": cid})).mappings()
        return [Message(**r) for r in rows]

    async def full_tree(self, cid: str, session: AsyncSession) -> List[Message]:
        stmt = select(Message).where(Message.conversation_id == cid)
        return list((await session.scalars(stmt)).all())

    async def message_versions(
        self, mid: str, session: AsyncSession
    ) -> List[Message]:
        """
        Returns **all** siblings that share the same parent, ordered by version.
        """
        me: Message | None = await session.get(Message, mid)
        if me is None:
            return []

        # root messages (parent_id is NULL) are considered un-versioned
        if me.parent_id is None:
            return [me]

        stmt = (
            select(Message)
            .where(Message.parent_id == me.parent_id)
            .order_by(Message.version)
        )
        return list((await session.scalars(stmt)).all())

    # ──────────────────────────────── mutations ────────────────────────────────── #

    async def add_message(self, msg: Message, session: AsyncSession) -> None:
        session.add(msg)
        await session.flush()

    async def edit_message(
        self, msg_id: str, new_content: str, session: AsyncSession
    ) -> Tuple[Message, str]:
        """
        Creates a **sibling version** of `msg_id` (version + 1) and returns it.
        """
        original: Message | None = await session.get(Message, msg_id)
        if original is None:
            raise ValueError(f"message {msg_id!r} not found")

        sibling = Message(
            conversation_id=original.conversation_id,
            parent_id=original.parent_id,
            version=original.version + 1,
            role=original.role,
            content=new_content,
        )
        session.add(sibling)

        # Flip parent pointer in the same transaction (if parent exists)
        if original.parent_id:
            await self.set_active_child(original.parent_id, sibling.id, session)

        await session.flush()
        return sibling, sibling.id

    async def set_active_child(
        self, parent_id: str, child_id: str, session: AsyncSession
    ) -> None:
        await session.execute(
            update(Message)
            .where(Message.id == parent_id)
            .values(active_child_id=child_id)
        )

    async def update_message_content(
        self, mid: str, new: str, session: AsyncSession
    ) -> None:
        await session.execute(
            update(Message)
            .where(Message.id == mid)
            .values(content=new)
        )

    async def update_active_thread(
        self, cid: str, thread: list[str], session: AsyncSession
    ) -> None:
        """
        Stores the entire active thread array on the conversation row.
        Converts python list → Postgres JSON automatically.
        """
        await session.execute(
            update(Conversation)
            .where(Conversation.id == cid)
            .values(active_thread_ids=thread)
        )
