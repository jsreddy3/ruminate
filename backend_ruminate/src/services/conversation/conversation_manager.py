from typing import Optional, Dict, Any, List
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.services.ai.context_service import ContextService
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import re
import uuid

logger = logging.getLogger(__name__)

class ConversationManager:
    def __init__(self,
                 conversation_repository: ConversationRepository,
                 document_repository: DocumentRepository,
                 context_service: ContextService):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
        self.context_service = context_service
        
    def _strip_html(self, html_content: Optional[str]) -> str:
        """Simple text extraction from HTML content"""
        if not html_content:
            return ""
        return re.sub(r'<[^>]+>', ' ', html_content).strip()
        
    async def get_messages_by_ids(self, conversation_id: str, message_ids: List[str], session: Optional[AsyncSession] = None) -> List[Message]:
        """Get messages by their IDs in order"""
        logger.debug(f"Getting {len(message_ids)} messages by ID for conversation: {conversation_id}")
        
        # Check if message_ids contains actual Message objects and convert to IDs if so
        id_list = []
        for item in message_ids:
            if isinstance(item, str):
                id_list.append(item)
            elif hasattr(item, 'id'):  # It's likely a Message object
                id_list.append(item.id)
                logger.warning(f"Received Message object instead of ID string in message_ids")
        
        # If we ended up with no valid IDs, just return empty list
        if not id_list:
            logger.warning("No valid message IDs to fetch")
            return []
            
        # Continue with normal processing using string IDs
        all_messages = await self.conversation_repo.get_messages(conversation_id, session)
        
        # Create dictionary with string keys
        messages_by_id = {msg.id: msg for msg in all_messages}
        
        # Build result list
        result = [messages_by_id[msg_id] for msg_id in id_list if msg_id in messages_by_id]
        
        logger.debug(f"Found {len(result)}/{len(id_list)} requested messages")
        return result
    
    async def update_active_thread(self, conversation_id: str, active_thread_ids: List[str], session: Optional[AsyncSession] = None) -> None:
        """Update the active thread for a conversation"""
        logger.debug(f"Updating active thread for conversation {conversation_id} with {len(active_thread_ids)} messages")
        await self.conversation_repo.update_active_thread(conversation_id, active_thread_ids, session)
        
    async def create_user_message(self, conversation_id: str, content: str, parent_id: str, session: Optional[AsyncSession] = None) -> Message:
        """Create and save a user message"""
        logger.debug(f"Creating user message in conversation {conversation_id}")
        user_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=content,
            parent_id=parent_id
        )
        await self.conversation_repo.add_message(user_msg, session)
        return user_msg
        
    async def create_ai_message(self, conversation_id: str, content: str, parent_id: str, session: Optional[AsyncSession] = None, metadata: Optional[Dict] = None) -> Message:
        """Create and save an AI assistant message"""
        logger.debug(f"Creating AI message in conversation {conversation_id}")
        ai_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content=content,
            parent_id=parent_id,
            metadata=metadata
        )
        await self.conversation_repo.add_message(ai_msg, session)
        logger.info(f"Created message with id: {ai_msg.id}")
        return ai_msg

    async def create_conversation(
        self,
        document_id: str,
        session: Optional[AsyncSession] = None,
        *,
        conversation_type: Optional[Any] = None,
        block_id: Optional[str] = None,
        selected_text: Optional[str] = None,
        text_start_offset: Optional[int] = None,
        text_end_offset: Optional[int] = None,
        template_key: str = "regular_conversation",
        template_vars: Optional[Dict] = None,
        extra_conversation_kwargs: Optional[Dict] = None,
    ) -> Conversation:
        """
        Create a new conversation, supporting both chat and agent/rabbithole use cases.
        """
        # 1. Verify document exists
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")

        # 2. (Optional) Verify block exists for agent/rabbithole
        block = None
        if block_id:
            block = await self.document_repo.get_block(block_id, session)
            if not block:
                raise ValueError(f"Block {block_id} not found")

        # 3. Build conversation object with all relevant metadata
        conversation_kwargs = dict(document_id=document_id)
        if conversation_type:
            conversation_kwargs["type"] = conversation_type
        if block_id:
            conversation_kwargs["source_block_id"] = block_id
        if selected_text is not None:
            conversation_kwargs["selected_text"] = selected_text
        if text_start_offset is not None:
            conversation_kwargs["text_start_offset"] = text_start_offset
        if text_end_offset is not None:
            conversation_kwargs["text_end_offset"] = text_end_offset
        if extra_conversation_kwargs:
            conversation_kwargs.update(extra_conversation_kwargs)

        conversation = Conversation(**conversation_kwargs)
        conversation = await self.conversation_repo.create_conversation(conversation, session)

        # 4. Prepare template variables if not provided
        if template_vars is None:
            template_vars = {
                "document_title": document.title,
                "include_sections": [],
                "document_summary": getattr(document, "summary", None),
            }
            if selected_text is not None:
                template_vars["selected_text"] = selected_text
            if block:
                block_content = self.context_service._strip_html(block.html_content) if block.html_content else ""
                if block_content:
                    template_vars["include_sections"].append("block_context")
                    template_vars["block_content"] = block_content
                if hasattr(block, "block_type"):
                    template_vars["block_type"] = block.block_type

        # 5. Create system message using the template
        system_msg = await self.context_service.create_system_message(
            conversation_id=conversation.id,
            template_key=template_key,
            template_vars=template_vars
        )

        # 6. Set root message and save both conversation and system message
        conversation.root_message_id = system_msg.id
        await self.conversation_repo.update_conversation(conversation, session)
        await self.conversation_repo.add_message(system_msg, session)

        return conversation