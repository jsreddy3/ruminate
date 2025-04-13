from typing import List, Optional, Dict, Tuple
from src.models.conversation.conversation import Conversation, ConversationType
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.services.ai.context_service import ContextService
import uuid
import logging
import re
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

class RabbitholeConversationService:
    def __init__(self, 
                conversation_repository: ConversationRepository,
                document_repository: DocumentRepository):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
        self.context_service = ContextService(conversation_repository, document_repository)
    
    def _strip_html(self, html_content: Optional[str]) -> str:
        """Simple text extraction from HTML content"""
        if not html_content:
            return ""
        return re.sub(r'<[^>]+>', ' ', html_content).strip()
    
    async def create_rabbithole(self,
                               document_id: str,
                               block_id: str,
                               selected_text: str,
                               start_offset: int,
                               end_offset: int,
                               document_conversation_id: Optional[str],
                               session: Optional[AsyncSession] = None) -> str:
        """
        Create a new rabbithole conversation from selected text in a block.
        
        A rabbithole conversation is a focused discussion specifically about a
        selected portion of text in a document. This allows users to dive deeper
        into specific parts of a document.
        
        Args:
            document_id: The ID of the document
            block_id: The ID of the block containing the selected text
            selected_text: The text that was selected/highlighted
            start_offset: Start position of the selected text
            end_offset: End position of the selected text
            document_conversation_id: ID of the main document conversation
            
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
        
        # Prepare template variables
        template_vars = {
            "document_title": document.title,
            "selected_text": selected_text,
            "include_sections": [],
            "block_type": block.block_type if hasattr(block, 'block_type') else "text"
        }
        
        # Add block content if available
        block_content = self._strip_html(block.html_content) if block.html_content else ""
        if block_content:
            template_vars["include_sections"].append("block_context")
            template_vars["block_content"] = block_content
        
        # Add document summary if available
        if document.summary:
            template_vars["include_sections"].append("document_summary")
            template_vars["document_summary"] = document.summary
        
        # Add document conversation context if available
        if document_conversation_id:
            # Get the last few messages from the document conversation for context
            document_conversation = await self._get_document_conversation_context(document_conversation_id, session)
            if document_conversation:
                template_vars["include_sections"].append("document_conversation")
                template_vars["conversation_context"] = document_conversation
        
        # Create system message using template
        system_msg = await self.context_service.create_system_message(
            conversation_id=conversation.id,
            template_key="rabbithole_conversation",
            template_vars=template_vars
        )
        
        # Set root message
        conversation.root_message_id = system_msg.id
        
        # Save updates
        await self.conversation_repo.update_conversation(conversation, session)
        await self.conversation_repo.add_message(system_msg, session)

        return conversation.id
    
    async def _get_document_conversation_context(self, conversation_id: str, session: Optional[AsyncSession] = None) -> Optional[str]:
        """Get context from the document conversation to include in the rabbithole"""
        if not conversation_id:
            return None
            
        try:
            # Get last few messages from the conversation
            messages = await self.conversation_repo.get_active_thread(conversation_id, session)
            if not messages or len(messages) <= 1:  # Skip if just system message
                return None
                
            # Format the messages into a readable context
            context_parts = []
            # Skip the first message (usually system message)
            for msg in messages[1:]:
                role = "User" if msg.role == MessageRole.USER else "Assistant"
                # Truncate long messages
                content = msg.content
                if len(content) > 200:
                    content = content[:200] + "..."
                context_parts.append(f"{role}: {content}")
                
            # Limit to last 3-5 exchanges to keep context manageable
            context_parts = context_parts[-6:]
            return "\n\n".join(context_parts)
        except Exception as e:
            logger.error(f"Error getting conversation context: {e}")
            return None
    
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