from typing import List, Optional
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.models.viewer.block import Block
import uuid
import logging

logger = logging.getLogger(__name__)

class ContextService:
    def __init__(self, 
                 conversation_repository: ConversationRepository,
                 document_repository: DocumentRepository):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
    
    async def build_message_context(self, conversation_id: str, new_message: Message, active_thread_ids: List[str]) -> List[Message]:
        """Build context for LLM by getting the active thread of messages"""
        all_messages = await self.conversation_repo.get_messages(conversation_id)
        messages_by_id = {msg.id: msg for msg in all_messages}
        
        # Build context from the provided thread IDs
        context = [messages_by_id[msg_id] for msg_id in active_thread_ids if msg_id in messages_by_id]
        context.append(new_message)
        return context