# new_backend_ruminate/domain/repositories/conversation_repository.py
from abc import ABC, abstractmethod
from typing import List, AsyncIterator, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.message import Message
from ..models.conversation import Conversation


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

    # mutations
    @abstractmethod
    async def add_message(self, msg: Message, session: AsyncSession) -> None: ...
    @abstractmethod
    async def edit_message(
        self, msg_id: str, new_content: str, session: AsyncSession
    ) -> tuple[Message, str]: ...
    @abstractmethod
    async def set_active_child(self, parent_id: str, child_id: str, session: AsyncSession) -> None: ...
    @abstractmethod
    async def update_message_content(self, mid: str, new: str, session: AsyncSession) -> None: ...
    @abstractmethod
    async def update_active_thread(self, cid: str, thread: list[str], session: AsyncSession) -> None: ...
