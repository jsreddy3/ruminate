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
    
    async def build_message_context(self, conversation_id: str, new_message: Message) -> List[Message]:
        """Build context for LLM by getting the active thread of messages"""
        # Get active thread
        thread = await self.conversation_repo.get_active_thread(conversation_id)
        if not thread:
            # Get conversation to verify it exists
            conversation = await self.conversation_repo.get_conversation(conversation_id)
            if not conversation:
                raise ValueError(f"Conversation {conversation_id} not found")
            thread = []
        
        # Add new message to context
        context = thread.copy()  # Make a copy to avoid modifying the original
        context.append(new_message)
        return context