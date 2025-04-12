from typing import List, Optional, Tuple, Dict
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.models.viewer.block import Block
import uuid
import logging
import re

logger = logging.getLogger(__name__)

class ContextService:
    def __init__(self, 
                 conversation_repository: ConversationRepository,
                 document_repository: DocumentRepository):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
    
    def _strip_html(self, html_content: Optional[str]) -> str:
        """Simple text extraction from HTML content"""
        if not html_content:
            return ""
        return re.sub(r'<[^>]+>', ' ', html_content).strip()
    
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
    
    async def enhance_context_with_block(self, 
                                        conversation: Conversation, 
                                        user_msg: Message, 
                                        selected_block_id: Optional[str] = None,
                                        session: Optional[object] = None) -> Tuple[List[Message], Dict[str, str]]:
        """
        Enhance message context with selected block and page content
        Returns: (enhanced context messages, pages_tracking_info)
        """
        # Build the base message context
        context_messages = await self.build_message_context(conversation.id, user_msg)
        
        # Track selected block and pages
        selected_block = None
        pages_content = ""
        
        # Initialize included_pages if not present
        if not hasattr(conversation, 'included_pages') or conversation.included_pages is None:
            conversation.included_pages = {}
            logger.info(f"Initialized included_pages tracking for conversation {conversation.id}")
        
        # Get selected block content if specified
        if selected_block_id:
            selected_block = await self.document_repo.get_block(selected_block_id, session)
            if selected_block and selected_block.page_number is not None:
                document_id = selected_block.document_id
                current_page_num = selected_block.page_number
                prev_page_num = current_page_num - 1 if current_page_num > 0 else None
                
                logger.info(f"Selected block is on page {current_page_num} (document: {document_id})")
                
                # Check if current page needs to be included
                if str(current_page_num) not in conversation.included_pages:
                    logger.info(f"Current page {current_page_num} not yet included in conversation")
                    current_page = await self.document_repo.get_page_by_number(document_id, current_page_num, session)
                    if current_page:
                        current_page_blocks = await self.document_repo.get_page_blocks(current_page.id, session)
                        if current_page_blocks:
                            current_page_text = "\n".join([self._strip_html(block.html_content) for block in current_page_blocks if block.html_content])
                            pages_content += f"Current page (Page {current_page_num + 1}):\n---\n{current_page_text}\n---\n\n"
                            conversation.included_pages[str(current_page_num)] = user_msg.id
                            logger.info(f"Added page {current_page_num} to included pages")
                
                # Check if previous page needs to be included
                if prev_page_num is not None and str(prev_page_num) not in conversation.included_pages:
                    logger.info(f"Previous page {prev_page_num} not yet included in conversation")
                    prev_page = await self.document_repo.get_page_by_number(document_id, prev_page_num, session)
                    if prev_page:
                        prev_page_blocks = await self.document_repo.get_page_blocks(prev_page.id, session)
                        if prev_page_blocks:
                            prev_page_text = "\n".join([self._strip_html(block.html_content) for block in prev_page_blocks if block.html_content])
                            pages_content = f"Previous page (Page {prev_page_num + 1}):\n---\n{prev_page_text}\n---\n\n" + pages_content
                            conversation.included_pages[str(prev_page_num)] = user_msg.id
                            logger.info(f"Added page {prev_page_num} to included pages")
        
        # Add selected block content
        selected_block_text = None
        if selected_block and selected_block.html_content:
            selected_block_text = self._strip_html(selected_block.html_content)
            logger.info(f"Fetched content for selected block {selected_block_id}")
        
        # Enhance user message content
        enhanced_content = ""
        
        # Add page content if any pages were included
        if pages_content:
            enhanced_content += pages_content
        
        # Add selected block content
        if selected_block_text:
            enhanced_content += f"Selected block content:\n---\n{selected_block_text}\n---\n\n"
        
        # Add original user query
        enhanced_content += user_msg.content
        
        # Modify the context with enhanced content if needed
        if enhanced_content:
            # Create a copy of the last message to avoid modifying the original
            enhanced_user_msg = context_messages[-1]
            enhanced_user_msg.content = enhanced_content
            logger.info(f"Enhanced context with page and block content")
        
        # Log context information for verification
        self._log_context_info(conversation.id, conversation.included_pages, selected_block, selected_block_id, context_messages)
        
        return context_messages, conversation.included_pages
    
    def _log_context_info(self, conversation_id, included_pages, selected_block, selected_block_id, context_messages):
        """Log detailed context information for verification"""
        logger.info("---------- CONTEXT VERIFICATION ----------")
        logger.info(f"Conversation ID: {conversation_id}")
        logger.info(f"Included Pages: {included_pages}")
        if selected_block:
            logger.info(f"Selected Block: ID={selected_block_id}, Page={selected_block.page_number}")
        
        # Log the messages being sent to the LLM
        logger.info("Messages being sent to LLM:")
        for i, msg in enumerate(context_messages):
            # Truncate long content for readability in logs
            content_preview = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
            logger.info(f"  Message {i+1}: Role={msg.role}, Content Preview={content_preview}")
        logger.info("----------------------------------------")