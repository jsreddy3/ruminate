# new_backend_ruminate/domain/conversation/repo.py
from abc import ABC, abstractmethod
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation


class ConversationRepository(ABC):
    # creation / reads
    @abstractmethod
    async def create(self, conv: Conversation, session: AsyncSession) -> Conversation: ...
    @abstractmethod
    async def get(self, cid: str, session: AsyncSession) -> Optional[Conversation]: ...
    @abstractmethod
    async def latest_thread(self, cid: str, session: AsyncSession) -> List[Message]: ...
    @abstractmethod
    async def full_tree(self, cid: str, session: AsyncSession) -> List[Message]: ...
    @abstractmethod
    async def message_versions(self, mid: str, session: AsyncSession) -> List[Message]: ...
    @abstractmethod
    async def get_message(self, mid: str, session: AsyncSession) -> Optional[Message]: ...

    # queries
    @abstractmethod
    async def get_conversations_by_criteria(
        self, criteria: dict, session: AsyncSession
    ) -> List[Conversation]: ...
    
    # mutations
    @abstractmethod
    async def add_message(self, msg: Message, session: AsyncSession) -> None: ...
    @abstractmethod
    async def edit_message(
        self, msg_id: str, new_content: str, session: AsyncSession, block_id: str | None = None
    ) -> tuple[Message, str]: ...
    @abstractmethod
    async def set_active_child(self, parent_id: str, child_id: str, session: AsyncSession) -> None: ...
    @abstractmethod
    async def update_message_content(self, mid: str, new: str, session: AsyncSession) -> None: ...
    @abstractmethod
    async def update_active_thread(self, cid: str, thread: list[str], session: AsyncSession) -> None: ...
