# new_backend_ruminate/services/conversation/rabbithole_service.py

from typing import List, Optional, Dict, Any
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.conversation.repo import ConversationRepository
from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.domain.ports.llm import LLMService
from new_backend_ruminate.context.builder import ContextBuilder
from new_backend_ruminate.context.prompts import default_system_prompts


class RabbitholeService:
    """Service for creating and managing text-integrated rabbithole conversations"""
    
    def __init__(
        self,
        conversation_repo: ConversationRepository,
        document_repo: RDSDocumentRepository,
        llm: LLMService,
        hub: EventStreamHub,
        ctx_builder: ContextBuilder,
    ) -> None:
        self.conversation_repo = conversation_repo
        self.document_repo = document_repo
        self.llm = llm
        self.hub = hub
        self.ctx_builder = ctx_builder
    
    async def create_rabbithole(
        self,
        *,
        user_id: str,
        document_id: str,
        block_id: str,
        selected_text: str,
        start_offset: int,
        end_offset: int,
        parent_conversation_id: Optional[str] = None,
        session: AsyncSession
    ) -> str:
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
            parent_conversation_id: ID of the main document conversation (optional)
            session: Database session
            
        Returns:
            The ID of the newly created rabbithole conversation
        """
        # Verify document exists and user owns it
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        if document.user_id != user_id:
            raise PermissionError("Access denied: You don't own this document")
        
        # Verify block exists and belongs to the document
        block = await self.document_repo.get_block(block_id, session)
        if not block:
            raise ValueError(f"Block {block_id} not found")
        if block.document_id != document_id:
            raise ValueError(f"Block {block_id} does not belong to document {document_id}")
        
        # Create rabbithole conversation
        conversation = Conversation(
            id=str(uuid4()),
            user_id=user_id,
            document_id=document_id,
            type=ConversationType.RABBITHOLE,
            source_block_id=block_id,
            selected_text=selected_text,
            text_start_offset=start_offset,
            text_end_offset=end_offset
        )
        await self.conversation_repo.create(conversation, session)
        
        # Create system message with rabbithole template
        system_msg = Message(
            id=str(uuid4()),
            conversation_id=conversation.id,
            role=Role.SYSTEM,
            content=default_system_prompts["rabbithole"],
            version=0,
            user_id=user_id,
        )
        await self.conversation_repo.add_message(system_msg, session)
        
        # Set root message and update active thread
        conversation.root_message_id = system_msg.id
        await self.conversation_repo.update_active_thread(
            conversation.id, 
            [system_msg.id], 
            session
        )
        
        return conversation.id
    
    async def get_rabbitholes_for_block(
        self, 
        block_id: str, 
        user_id: str,
        session: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        Get all rabbithole conversations for a specific block.
        Returns a list of rabbithole info dictionaries with metadata for UI display.
        """
        # Query conversations by block ID and user
        conversations = await self.conversation_repo.get_conversations_by_criteria(
            criteria={
                "source_block_id": block_id, 
                "type": ConversationType.RABBITHOLE,
                "user_id": user_id
            },
            session=session
        )
        
        # Format for UI display
        return [
            {
                "id": conv.id,
                "selected_text": conv.selected_text,
                "text_start_offset": conv.text_start_offset,
                "text_end_offset": conv.text_end_offset,
                "created_at": conv.created_at.isoformat() if hasattr(conv.created_at, 'isoformat') else str(conv.created_at),
                "conversation_id": conv.id
            }
            for conv in conversations
        ]
    
    async def get_rabbitholes_for_document(
        self, 
        document_id: str, 
        user_id: str,
        session: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        Get all rabbithole conversations for a document.
        Returns a list of rabbithole info dictionaries with metadata for UI display.
        """
        # Query conversations by document ID and user
        conversations = await self.conversation_repo.get_conversations_by_criteria(
            criteria={
                "document_id": document_id, 
                "type": ConversationType.RABBITHOLE,
                "user_id": user_id
            },
            session=session
        )
        
        # Format for UI display
        return [
            {
                "id": conv.id,
                "block_id": conv.source_block_id,
                "selected_text": conv.selected_text,
                "text_start_offset": conv.text_start_offset,
                "text_end_offset": conv.text_end_offset,
                "created_at": conv.created_at.isoformat() if hasattr(conv.created_at, 'isoformat') else str(conv.created_at)
            }
            for conv in conversations
        ]