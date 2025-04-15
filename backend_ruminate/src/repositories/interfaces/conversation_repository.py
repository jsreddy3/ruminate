from abc import ABC, abstractmethod
from typing import List, Optional, TypeVar, Tuple, Dict, Any
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message

DBSession = TypeVar('DBSession')

class ConversationRepository(ABC):
    @abstractmethod
    async def create_conversation(self, conversation: Conversation, session: Optional[DBSession] = None) -> Conversation:
        """Create a new conversation"""
        pass
    
    @abstractmethod
    async def update_conversation(self, conversation: Conversation, session: Optional[DBSession] = None) -> Conversation:
        """Update an existing conversation"""
        pass
    
    @abstractmethod
    async def get_conversation(self, conversation_id: str, session: Optional[DBSession] = None) -> Optional[Conversation]:
        """Get a conversation by ID"""
        pass
    
    @abstractmethod
    async def get_document_conversations(self, document_id: str, session: Optional[DBSession] = None) -> List[Conversation]:
        """Get all conversations for a document"""
        pass
    
    @abstractmethod
    async def add_message(self, message: Message, session: Optional[DBSession] = None) -> Message:
        """Add a new message to a conversation"""
        pass
    
    @abstractmethod
    async def get_messages(self, conversation_id: str, session: Optional[DBSession] = None) -> List[Message]:
        """Get all messages for a conversation"""
        pass
    

    @abstractmethod
    async def edit_message(self, message_id: str, new_content: str, session: Optional[DBSession] = None) -> Tuple[Message, str]:
        """Edit a message by creating a new version"""
        pass

    @abstractmethod
    async def get_message_versions(self, message_id: str, session: Optional[DBSession] = None) -> List[Message]:
        """Get all versions of a message"""
        pass

    @abstractmethod
    async def get_message_tree(self, conversation_id: str, session: Optional[DBSession] = None) -> List[Message]:
        """Get all messages in a conversation as a tree structure, including versions and branches"""
        pass

    @abstractmethod
    async def get_message(self, message_id: str, session: Optional[DBSession] = None) -> Optional[Message]:
        """Get a message by ID"""
        pass

    @abstractmethod
    async def set_active_version(self, message_id: str, active_child_id: str, session: Optional[DBSession] = None) -> None:
        """Set the active version of a message"""
        pass

    @abstractmethod
    async def get_conversations_by_criteria(self, criteria: Dict[str, Any], session: Optional[DBSession] = None) -> List[Conversation]:
        """Get conversations matching the provided criteria"""
        pass

    @abstractmethod
    async def update_active_thread(self, conversation_id: str, active_thread_ids: List[str], session: Optional[DBSession] = None) -> None:
        """Update the active thread IDs in the conversation record"""
        pass

    @abstractmethod
    async def get_message_by_id(self, message_id: str, session: Optional[DBSession] = None) -> Optional[Message]:
        """Get a single message by its unique ID."""
        pass

    @abstractmethod
    async def update_message_content(self, message_id: str, new_content: str, session: Optional[DBSession] = None) -> None:
        """Update the content of a specific message."""
        pass

    @abstractmethod
    async def get_message(self, message_id: str, session: Optional[DBSession] = None) -> Optional[Message]:
        pass
