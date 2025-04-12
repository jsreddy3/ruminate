from typing import List, Optional, Tuple, AsyncGenerator
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.services.ai.llm_service import LLMService
from src.services.ai.context_service import ContextService
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from datetime import datetime
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Reduce logging from other libraries
logging.getLogger('multipart').setLevel(logging.WARNING)
logging.getLogger('aiosqlite').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

class ChatService:
    def __init__(self, 
                 conversation_repository: ConversationRepository,
                 document_repository: DocumentRepository,
                 llm_service: LLMService):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
        self.llm_service = llm_service
        self.context_service = ContextService(conversation_repository, document_repository)
    
    def _strip_html(self, html_content: Optional[str]) -> str:
        """Simple text extraction from HTML content"""
        if not html_content:
            return ""
        return re.sub(r'<[^>]+>', ' ', html_content).strip()
    
    async def create_conversation(self, document_id: str, session: Optional[AsyncSession] = None) -> Conversation:
        """Create a new conversation"""
        # Verify document exists
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Create conversation
        conversation = Conversation(
            document_id=document_id
        )
        conversation = await self.conversation_repo.create_conversation(conversation, session)
        
        # Create system message with document context
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")
            
        # Build system message content
        content = f"This is a conversation about the document: {document.title}\n"
        # Add document summary if available
        if document.summary:
            content += f"\nDocument Summary:\n{document.summary}\n"
        
        # Create and save system message
        system_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation.id,
            role=MessageRole.SYSTEM,
            content=content
        )
        conversation.root_message_id = system_msg.id
        
        # Save conversation and message
        await self.conversation_repo.update_conversation(conversation, session)
        await self.conversation_repo.add_message(system_msg, session)
        
        return conversation
    
    async def get_conversation(self, conversation_id: str, session: Optional[AsyncSession] = None) -> Optional[Conversation]:
        """Get a conversation by ID"""
        return await self.conversation_repo.get_conversation(conversation_id, session)
    
    async def get_active_thread(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get the active thread of messages in a conversation"""
        return await self.conversation_repo.get_active_thread(conversation_id, session)
    
    async def get_message_tree(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get the full tree of messages in a conversation, including all versions and branches"""
        
        # First verify the conversation exists
        conversation = await self.conversation_repo.get_conversation(conversation_id, session)
        if not conversation:
            logger.error(f"Conversation {conversation_id} not found")
            raise ValueError(f"Conversation {conversation_id} not found")
            
        # Get all messages in the conversation
        messages = await self.conversation_repo.get_messages(conversation_id, session)
        if not messages:
            return []
            
        # Build lookup tables for efficient traversal
        messages_by_id = {msg.id: msg for msg in messages}
        children_by_parent = {}
        
        # Group messages by parent_id to find all children (including versions)
        for msg in messages:
            if msg.parent_id:
                if msg.parent_id not in children_by_parent:
                    children_by_parent[msg.parent_id] = []
                children_by_parent[msg.parent_id].append(msg)
                
        # Find root message (system message with no parent)
        root = next((msg for msg in messages if msg.parent_id is None and msg.role == MessageRole.SYSTEM), None)
        if not root:
            logger.error(f"No root message found in conversation {conversation_id}")
            raise ValueError(f"No root message found in conversation {conversation_id}")
            
        # For each message, ensure active_child_id points to the latest version in its branch
        for msg_id, children in children_by_parent.items():
            parent = messages_by_id[msg_id]
            # If parent has no active_child_id set, set it to the latest child
            if not parent.active_child_id and children:
                # Sort by creation time if available, otherwise use the last message
                latest = sorted(children, key=lambda m: m.created_at if hasattr(m, 'created_at') else float('inf'))[-1]
                parent.active_child_id = latest.id
                
        # Return all messages - the tree structure is defined by:
        # 1. parent_id links showing message relationships
        # 2. Messages with same parent_id are versions
        # 3. active_child_id showing which version is current
        return messages
    
    async def send_message(self,
                           conversation_id: str,
                           content: str,
                           parent_version_id: Optional[str] = None,
                           selected_block_id: Optional[str] = None,
                           session: Optional[AsyncSession] = None) -> Tuple[Message, str]:
        """Send a user message and get AI response, incorporating selected block context if provided"""
        logger.info(f"Sending message to conversation {conversation_id}, selected block: {selected_block_id}")

        conversation = await self.conversation_repo.get_conversation(conversation_id, session)
        if not conversation:
            logger.error(f"Conversation {conversation_id} not found")
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Initialize included_pages if not present
        if not hasattr(conversation, 'included_pages') or conversation.included_pages is None:
            conversation.included_pages = {}
            logger.info(f"Initialized included_pages tracking for conversation {conversation_id}")

        # Get parent message ID
        thread = await self.conversation_repo.get_active_thread(conversation_id, session)
        parent_id = None
        if parent_version_id:
             parent_msg = next((msg for msg in thread if msg.id == parent_version_id), None)
             if not parent_msg:
                 raise ValueError(f"Parent version {parent_version_id} not found")
             parent_id = parent_version_id
        else:
             parent_id = thread[-1].id if thread else conversation.root_message_id # Fallback to root if thread is empty

        # --- Create User Message ---
        user_msg_content = content # Keep original user content clean
        user_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=user_msg_content,
            parent_id=parent_id
        )
        await self.conversation_repo.add_message(user_msg, session)
        if user_msg.parent_id:
             await self.conversation_repo.set_active_version(user_msg.parent_id, user_msg.id, session)

        # --- Enhanced Context Preparation ---
        selected_block = None
        pages_content = ""
        
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
                
                # Update conversation with page tracking info if changes were made
                if pages_content:
                    await self.conversation_repo.update_conversation(conversation, session)
                    logger.info(f"Updated conversation included_pages: {conversation.included_pages}")

        # Add selected block content
        selected_block_text = None
        if selected_block and selected_block.html_content:
            selected_block_text = self._strip_html(selected_block.html_content)
            logger.info(f"Fetched content for selected block {selected_block_id}")

        # Build the message list for the LLM
        context_messages = await self.context_service.build_message_context(conversation_id, user_msg)

        # Modify the last user message to include page context and selected block
        enhanced_content = ""
        
        # Add page content if any pages were included
        if pages_content:
            enhanced_content += pages_content
        
        # Add selected block content
        if selected_block_text:
            enhanced_content += f"Selected block content:\n---\n{selected_block_text}\n---\n\n"
        
        # Add user query
        enhanced_content += user_msg_content
        
        # Only modify the content if we have enhancements
        if enhanced_content:
            context_messages[-1].content = enhanced_content
            logger.info(f"Enhanced context with page and block content")
        
        # Log detailed context information for verification
        logger.info("---------- CONTEXT VERIFICATION ----------")
        logger.info(f"Conversation ID: {conversation_id}")
        logger.info(f"Included Pages: {conversation.included_pages}")
        if selected_block:
            logger.info(f"Selected Block: ID={selected_block_id}, Page={selected_block.page_number}")
        
        # Log the messages being sent to the LLM
        logger.info("Messages being sent to LLM:")
        for i, msg in enumerate(context_messages):
            # Truncate long content for readability in logs
            content_preview = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
            logger.info(f"  Message {i+1}: Role={msg.role}, Content Preview={content_preview}")
        logger.info("----------------------------------------")

        # --- Generate AI Response ---
        response_content = await self.llm_service.generate_response(context_messages)
        logger.info("Generated response")

        # --- Create and Save AI Message ---
        ai_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content=response_content,
            parent_id=user_msg.id
        )
        await self.conversation_repo.add_message(ai_msg, session)
        await self.conversation_repo.set_active_version(user_msg.id, ai_msg.id, session)

        return ai_msg, user_msg.id # Return AI message and the *actual* user message ID 
    
    async def edit_message(self, message_id: str, content: str, session: Optional[AsyncSession] = None) -> Tuple[Message, str]:
        """Edit a message and regenerate the AI response"""
        # Create new version as sibling
        edited_msg, edited_msg_id = await self.conversation_repo.edit_message(message_id, content, session)
        
        # Update parent to point to new version as active child
        if edited_msg.parent_id:
            await self.conversation_repo.set_active_version(edited_msg.parent_id, edited_msg.id, session)
        
        # Find any existing AI response to the original message
        thread = await self.conversation_repo.get_active_thread(edited_msg.conversation_id, session)
        
        # Build context and generate new AI response
        context = await self.context_service.build_message_context(edited_msg.conversation_id, edited_msg)
        response_content = await self.llm_service.generate_response(context)
        
        # Create new AI response as sibling to any existing response
        ai_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=edited_msg.conversation_id,
            role=MessageRole.ASSISTANT,
            content=response_content,
            parent_id=edited_msg.id
        )
        
        # Save AI message
        await self.conversation_repo.add_message(ai_msg, session)
        
        # Set edited message's active child to new AI response
        await self.conversation_repo.set_active_version(edited_msg.id, ai_msg.id, session)
        
        return ai_msg, edited_msg_id
    
    async def get_message_versions(self, message_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all versions of a message"""
        return await self.conversation_repo.get_message_versions(message_id, session)
    
    async def get_document_conversations(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Conversation]:
        """Get all conversations for a document"""
        return await self.conversation_repo.get_document_conversations(document_id, session)
    
    async def stream_message(self,
                           conversation_id: str,
                           content: str,
                           parent_version_id: Optional[str] = None,
                           selected_block_id: Optional[str] = None,
                           session: Optional[AsyncSession] = None) -> AsyncGenerator[str, None]:
        """Send a user message and stream the AI response, incorporating selected block context if provided"""
        # Verify conversation exists
        conversation = await self.conversation_repo.get_conversation(conversation_id, session)
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")

        # --- Create User Message ---
        # Generate a new message ID
        user_msg_id = str(uuid.uuid4())
        user_msg_content = content.strip()
        
        # Find parent message for branching support
        parent_id = None
        thread = await self.conversation_repo.get_active_thread(conversation_id, session)
        if parent_version_id:
            parent_id = parent_version_id
        elif thread:
            # Find the last assistant message to use as parent
            for msg in reversed(thread):
                if msg.role == MessageRole.ASSISTANT:
                    parent_id = msg.id
                    break
        
        user_msg = Message(
            id=user_msg_id,
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=user_msg_content,
            parent_id=parent_id,
            timestamp=datetime.utcnow().isoformat()
        )
        
        # Save user message to DB
        await self.conversation_repo.add_message(user_msg, session)

        # --- Build Context for AI Response ---
        # If no parent was found, use the root message
        if not parent_id and conversation.root_message_id:
            parent_id = conversation.root_message_id

        # Build input context
        context_messages = await self.context_service.build_message_context(conversation_id, user_msg)
        
        # --- Enhance with selected block content if available ---
        selected_block = None
        if selected_block_id:
            selected_block = await self.document_repo.get_block(selected_block_id, session)
            if not selected_block:
                logger.warning(f"Selected block {selected_block_id} not found")
        
        # Enhance the message with block content if available
        enhanced_content = ""
        
        # Add reference to selected block content if it exists
        if selected_block and selected_block.html_content:
            selected_block_text = self._strip_html(selected_block.html_content)
            enhanced_content += f"Selected block content:\n---\n{selected_block_text}\n---\n\n"
        
        # Add user query
        enhanced_content += user_msg_content
        
        # Only modify the content if we have enhancements
        if enhanced_content:
            context_messages[-1].content = enhanced_content
            logger.info(f"Enhanced context with page and block content")
        
        # Log detailed context information for verification
        logger.info("---------- CONTEXT VERIFICATION ----------")
        logger.info(f"Conversation ID: {conversation_id}")
        logger.info(f"Included Pages: {conversation.included_pages}")
        if selected_block:
            logger.info(f"Selected Block: ID={selected_block_id}, Page={selected_block.page_number}")
        
        # Log the messages being sent to the LLM
        logger.info("Messages being sent to LLM:")
        for i, msg in enumerate(context_messages):
            # Truncate long content for readability in logs
            content_preview = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
            logger.info(f"  Message {i+1}: Role={msg.role}, Content Preview={content_preview}")
        logger.info("----------------------------------------")

        # --- Stream AI Response ---
        response_content = ""
        ai_msg_id = str(uuid.uuid4())
        
        # Create the AI message with empty content initially
        ai_msg = Message(
            id=ai_msg_id,
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content="",
            parent_id=user_msg.id
        )
        
        # Save initial empty AI message to establish the relationship
        await self.conversation_repo.add_message(ai_msg, session)
        await self.conversation_repo.set_active_version(user_msg.id, ai_msg.id, session)
        
        # Stream the response
        async for token in self.llm_service.stream_response(context_messages):
            response_content += token
            yield token
        
        # Now that streaming is complete, we need to update the message with the complete content
        # We'll use SQLAlchemy's update statement instead of trying to re-add the message
        local_session = session is None
        session_to_use = session or self.conversation_repo.session_factory()
        
        try:
            # Import the necessary components for the update
            from sqlalchemy import update
            from src.models.conversation.message import MessageModel
            
            # Use SQLAlchemy's update statement (safer than raw SQL)
            update_stmt = update(MessageModel).where(MessageModel.id == ai_msg_id).values(content=response_content)
            await session_to_use.execute(update_stmt)
            
            if local_session:
                await session_to_use.commit()
                
            logger.info("Completed streaming response")
        except Exception as e:
            if local_session:
                await session_to_use.rollback()
            logger.error(f"Error updating message content: {e}")
            # Don't re-raise to avoid breaking the streaming response
        finally:
            if local_session and session_to_use:
                await session_to_use.close()