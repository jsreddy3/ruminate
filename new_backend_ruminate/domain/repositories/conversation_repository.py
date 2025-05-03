# new_backend/domain/repositories/conversation_repository.py
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.models.conversation import Conversation
from new_backend_ruminate.domain.models.message import Message


class ConversationRepository(ABC):
    @abstractmethod
    async def create(self, conv: Conversation, session: AsyncSession) -> Conversation: ...

    @abstractmethod
    async def get(self, cid: str, session: AsyncSession) -> Optional[Conversation]: ...

    @abstractmethod
    async def add_message(self, msg: Message, session: AsyncSession) -> None: ...

    @abstractmethod
    async def latest_thread(self, cid: str, session: AsyncSession) -> List[Message]: ...

    @abstractmethod
    async def full_tree(self, cid: str, session: AsyncSession) -> List[Message]: ...

    @abstractmethod
    async def edit_message(
        self, msg_id: str, new_content: str, session: AsyncSession
    ) -> tuple[Message, str]: ...
