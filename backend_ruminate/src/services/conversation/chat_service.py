from typing import List, Optional, Tuple
from fastapi import BackgroundTasks
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.services.ai.llm_service import LLMService
from src.services.ai.context_service import ContextService
from src.api.chat_sse_manager import chat_sse_manager # Import the singleton instance
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
import logging
from datetime import datetime
import re
import asyncio

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
                 llm_service: LLMService,
                 db_session_factory: sessionmaker):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
        self.llm_service = llm_service
        self.context_service = ContextService(conversation_repository, document_repository)
        self.db_session_factory = db_session_factory
        logger.info("ChatService initialized.")
    
    def _strip_html(self, html_content: Optional[str]) -> str:
        """Simple text extraction from HTML content"""
        if not html_content:
            return ""
        return re.sub(r'<[^>]+>', ' ', html_content).strip()
    
    async def create_conversation(self, document_id: str, session: AsyncSession) -> Conversation:
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
        
        # Get document details for system message
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Create system message using template
        template_vars = {
            "document_title": document.title,
            "include_sections": ["document_summary"] if document.summary else [],
            "document_summary": document.summary
        }
        
        system_msg = await self.context_service.create_system_message(
            conversation_id=conversation.id,
            template_key="regular_conversation",
            template_vars=template_vars
        )
        
        # Set root message
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
                           background_tasks: BackgroundTasks, 
                           conversation_id: str,
                           content: str,
                           parent_id: str,
                           active_thread_ids: List[str],
                           selected_block_id: Optional[str] = None,
                           session: Optional[AsyncSession] = None 
                          ) -> Tuple[str, str]:
        """Accepts a user message, saves it, creates a placeholder AI message,
         returns their IDs immediately, and starts a background task for streaming LLM response.
         """
 
        # --- Ensure conversation exists --- 
        conversation = await self.conversation_repo.get_conversation(conversation_id, session)
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
 
        # --- Create and Save User Message --- 
        user_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=content,
            parent_id=parent_id
        )
        await self.conversation_repo.add_message(user_msg, session)
        logger.info(f"Created user message {user_msg.id} in conversation {conversation_id}")
 
        # --- Create and Save Placeholder AI Message --- 
        ai_msg = Message(
            id=str(uuid.uuid4()), # Generate ID now
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content="", # Start with empty content
            parent_id=user_msg.id # Link to user message
        )
        await self.conversation_repo.add_message(ai_msg, session)
        logger.info(f"Created placeholder AI message {ai_msg.id} in conversation {conversation_id}")
        
        # --- Update Conversation Active Thread (Immediately) --- 
        # This ensures the backend's active thread matches what the user sees
        updated_active_thread_ids = active_thread_ids + [user_msg.id] + [ai_msg.id] # Add both
        await self.conversation_repo.update_active_thread(conversation_id, updated_active_thread_ids, session)
        logger.info(f"Updated active thread for conversation {conversation_id}")
        
        # --- Add Background Task for LLM Generation and Streaming --- 
        # Pass necessary data to the background task
        background_tasks.add_task(
            self._generate_and_stream_response,
            conversation_id=conversation_id,
            user_msg=user_msg, # Pass the message object itself
            ai_msg_id=ai_msg.id, # Pass the ID of the placeholder
            initial_active_thread_ids=active_thread_ids + [user_msg.id], # Thread *before* AI msg
            selected_block_id=selected_block_id
        )
        logger.info(f"Added background task for AI message {ai_msg.id}")
        
        # --- Return User and AI Message IDs Immediately --- 
        return user_msg.id, ai_msg.id
    
    async def _generate_and_stream_response(
        self,
        conversation_id: str,
        user_msg: Message,
        ai_msg_id: str,
        initial_active_thread_ids: List[str],
        selected_block_id: Optional[str]
    ):
        """Background task to generate LLM response, stream it via SSE, and update the placeholder message."""
        logger.info(f"Starting background task for AI message {ai_msg_id}")
        full_response_content = ""
        
        # Create a new session scope for this background task
        async with self.db_session_factory() as session:
            try:
                conversation = await self.conversation_repo.get_conversation(conversation_id, session)
                if not conversation:
                    logger.error(f"[Task {ai_msg_id}] Conversation {conversation_id} not found within new session.")
                    await chat_sse_manager.publish_chunk(ai_msg_id, "Error: Conversation not found.")
                    # Cannot update DB if conversation not found
                    return # Exit early

                # --- Use ContextService to build enhanced context --- 
                context_messages, updated_included_pages = await self.context_service.enhance_context_with_block(
                    conversation,
                    user_msg, # Use the user message that triggered this
                    initial_active_thread_ids, # Use the thread leading up to the user message
                    selected_block_id,
                    session
                )
                
                # Update conversation included pages if they changed (async task needs care with concurrent updates)
                # Consider if this update is critical here or can be handled differently
                if conversation.included_pages != updated_included_pages:
                    conversation.included_pages = updated_included_pages
                    # await self.conversation_repo.update_conversation(conversation, session) # Be cautious with updates from background tasks
                    logger.info(f"[Task {ai_msg_id}] Included pages updated (update deferred/skipped in background task for now)")
                
                # --- Generate AI Response via Stream --- 
                logger.info(f"[Task {ai_msg_id}] Calling LLM stream generation.")
                llm_stream = self.llm_service.generate_response_stream(context_messages)
                
                async for chunk in llm_stream:
                    if chunk:
                        full_response_content += chunk
                        # Publish chunk via SSE manager
                        await chat_sse_manager.publish_chunk(ai_msg_id, chunk)
                
                logger.info(f"[Task {ai_msg_id}] Finished LLM stream. Full length: {len(full_response_content)}")
                
                # --- Update Placeholder AI Message in DB using new method --- 
                await self.conversation_repo.update_message_content(
                    message_id=ai_msg_id, 
                    new_content=full_response_content, 
                    session=session
                )
                # Logging for success is now handled within update_message_content
                # Error/warning for message not found is also handled there
                
            except Exception as e:
                logger.error(f"[Task {ai_msg_id}] Error during LLM stream generation or DB update: {e}", exc_info=True)
                # Optionally update the AI message content to indicate an error
                try:
                    error_ai_msg = await self.conversation_repo.get_message(ai_msg_id, session)
                    if error_ai_msg:
                        error_ai_msg.content = f"Error generating response: {e}"
                        await self.conversation_repo.update_message(error_ai_msg, session)
                except Exception as db_err:
                    logger.error(f"[Task {ai_msg_id}] Failed to update AI message with error state: {db_err}")
            finally:
                # --- Clean up SSE Queue --- 
                await chat_sse_manager.publish_chunk(ai_msg_id, "[DONE]")
                await chat_sse_manager.cleanup_stream_queue(ai_msg_id)
                # The session will be committed/rolled back automatically by the context manager
                logger.info(f"[Task {ai_msg_id}] Background task finished, session closed.")
    
    async def edit_message(self, message_id: str, content: str, active_thread_ids: List[str], session: Optional[AsyncSession] = None) -> Tuple[Message, str]:
        """Edit a message and regenerate the AI response"""
        # TODO: Implement streaming for edit_message similar to send_message
        # - Create edited version
        # - Create placeholder AI response
        # - Return IDs
        # - Launch background task (_regenerate_and_stream_response)
        # - Background task builds context from *edited* message, streams, publishes, updates DB, cleans up.
        logger.warning("edit_message streaming not yet implemented, using blocking call.")
        # Create new version as sibling
        edited_msg, edited_msg_id = await self.conversation_repo.edit_message(message_id, content, session)
        
        # Update the active thread in the conversation record
        # Instead of updating individual active_child_id pointers, store the complete thread
        updated_active_thread_ids = active_thread_ids + [edited_msg.id]
        await self.conversation_repo.update_active_thread(edited_msg.conversation_id, updated_active_thread_ids, session)
        
        # Build context using the provided active thread IDs and generate new AI response
        context = await self.context_service.build_message_context(
            edited_msg.conversation_id, 
            edited_msg,
            active_thread_ids
        )
        response_content = await self.llm_service.generate_response(context)
        
        # Create new AI response as child of edited message
        ai_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=edited_msg.conversation_id,
            role=MessageRole.ASSISTANT,
            content=response_content,
            parent_id=edited_msg.id
        )
        
        # Save AI message
        await self.conversation_repo.add_message(ai_msg, session)
        
        # Update the active thread to include the AI response
        updated_active_thread_ids = updated_active_thread_ids + [ai_msg.id]
        await self.conversation_repo.update_active_thread(edited_msg.conversation_id, updated_active_thread_ids, session)
        
        return ai_msg, edited_msg_id
    
    async def get_message_versions(self, message_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all versions of a message"""
        return await self.conversation_repo.get_message_versions(message_id, session)
    
    async def get_document_conversations(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Conversation]:
        """Get all conversations for a document"""
        return await self.conversation_repo.get_document_conversations(document_id, session)