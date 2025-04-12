from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import logging

from src.models.conversation.conversation import Conversation, ConversationType
from src.models.conversation.message import Message, MessageRole
from .chat_service import ChatService

logger = logging.getLogger(__name__)

class RabbitholeConversationService(ChatService):
    """Service for handling Rabbithole conversations - specialized deep dives into specific text selections."""
    
    async def create_rabbithole(self, 
                               document_id: str, 
                               block_id: str, 
                               selected_text: str,
                               start_offset: int,
                               end_offset: int,
                               session: Optional[AsyncSession] = None) -> str:
        """
        Create a new rabbithole conversation from selected text in a block.
        
        Args:
            document_id: ID of the document
            block_id: ID of the block containing the selected text
            selected_text: The text that was selected/highlighted
            start_offset: Start position of the selected text
            end_offset: End position of the selected text
            
        Returns:
            The ID of the newly created rabbithole conversation
        """
        # Verify document exists
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Verify block exists
        block = await self.document_repo.get_block(block_id, session)
        if not block:
            raise ValueError(f"Block {block_id} not found")
        
        # Create rabbithole conversation
        conversation = Conversation(
            document_id=document_id,
            type=ConversationType.RABBITHOLE,
            source_block_id=block_id,
            selected_text=selected_text,
            text_start_offset=start_offset,
            text_end_offset=end_offset
        )
        conversation = await self.conversation_repo.create_conversation(conversation, session)
        
        # Build enhanced system message with rabbithole context
        system_content = (
            f"This is a deep-dive conversation focused on the following selected text from document '{document.title}':\n\n"
            f"```\n{selected_text}\n```\n\n"
        )
        
        # Add context about the block if available
        block_content = self._strip_html(block.html_content) if block.html_content else ""
        if block_content:
            system_content += f"The selected text is from a block of type '{block.block_type}' with context:\n\n{block_content}\n\n"
            
        # Create specialized system message
        system_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation.id,
            role=MessageRole.SYSTEM,
            content=system_content
        )
        conversation.root_message_id = system_msg.id
        
        # Save updates
        await self.conversation_repo.update_conversation(conversation, session)
        await self.conversation_repo.add_message(system_msg, session)
        
        return conversation.id
    
    async def get_rabbitholes_for_block(self, block_id: str, session: Optional[AsyncSession] = None) -> List[Dict]:
        """
        Get all rabbithole conversations for a specific block.
        Returns a list of rabbithole info dictionaries with metadata for UI display.
        """
        # Get all rabbithole conversations for this block
        rabbitholes = await self.conversation_repo.get_conversations_by_criteria(
            criteria={"source_block_id": block_id, "type": ConversationType.RABBITHOLE.value},
            session=session
        )
        
        # Format for UI display
        return [
            {
                "id": r.id,
                "selected_text": r.selected_text,
                "text_start_offset": r.text_start_offset,
                "text_end_offset": r.text_end_offset,
                "created_at": r.created_at.isoformat() if hasattr(r.created_at, 'isoformat') else r.created_at
            }
            for r in rabbitholes
        ]
    
    async def get_rabbitholes_for_document(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Dict]:
        """
        Get all rabbithole conversations for a document.
        Returns a list of rabbithole info dictionaries with metadata for UI display.
        """
        # Get all rabbithole conversations for this document
        rabbitholes = await self.conversation_repo.get_conversations_by_criteria(
            criteria={"document_id": document_id, "type": ConversationType.RABBITHOLE.value},
            session=session
        )
        
        # Format for UI display
        return [
            {
                "id": r.id,
                "block_id": r.source_block_id,
                "selected_text": r.selected_text,
                "text_start_offset": r.text_start_offset,
                "text_end_offset": r.text_end_offset,
                "created_at": r.created_at.isoformat() if hasattr(r.created_at, 'isoformat') else r.created_at
            }
            for r in rabbitholes
        ]