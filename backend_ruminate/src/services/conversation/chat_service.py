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
from src.services.conversation.conversation_manager import ConversationManager
import re
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
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
        logger.info(f"ChatService.get_message_tree called for conversation {conversation_id}")
        
        try:
            # First verify the conversation exists
            logger.info(f"Verifying conversation {conversation_id} exists")
            conversation = await self.conversation_repo.get_conversation(conversation_id, session)
            if not conversation:
                logger.error(f"Conversation {conversation_id} not found")
                raise ValueError(f"Conversation {conversation_id} not found")
                
            # Get all messages in the conversation
            logger.info(f"Fetching messages for conversation {conversation_id}")
            messages = await self.conversation_repo.get_messages(conversation_id, session)
            
            if not messages:
                logger.info(f"No messages found for conversation {conversation_id}")
                return []
            
            logger.info(f"Retrieved {len(messages)} messages for conversation {conversation_id}")
            
            # Build lookup tables for efficient traversal
            logger.info("Building message lookup tables")
            try:
                messages_by_id = {msg.id: msg for msg in messages}
                children_by_parent = {}
                
                # Group messages by parent_id to find all children (including versions)
                for msg in messages:
                    if msg.parent_id:
                        if msg.parent_id not in children_by_parent:
                            children_by_parent[msg.parent_id] = []
                        children_by_parent[msg.parent_id].append(msg)
                
                logger.info(f"Found {len(children_by_parent)} parent messages with children")
                
                # Find root message (system message with no parent)
                root = next((msg for msg in messages if msg.parent_id is None and msg.role == MessageRole.SYSTEM), None)
                if not root:
                    logger.error(f"No root message found in conversation {conversation_id}")
                    raise ValueError(f"No root message found in conversation {conversation_id}")
                
                logger.info(f"Found root message with ID: {root.id}")
                
                # For each message, ensure active_child_id points to the latest version in its branch
                updated_parents = 0
                for msg_id, children in children_by_parent.items():
                    parent = messages_by_id[msg_id]
                    # If parent has no active_child_id set, set it to the latest child
                    if not parent.active_child_id and children:
                        # Sort by creation time if available, otherwise use the last message
                        latest = sorted(children, key=lambda m: m.created_at if hasattr(m, 'created_at') else float('inf'))[-1]
                        parent.active_child_id = latest.id
                        updated_parents += 1
                
                logger.info(f"Updated active_child_id for {updated_parents} parents")
                
                # Check for potential circular references that might cause serialization issues
                logger.info("Checking for circular references in the message tree...")
                circular_refs = set()
                
                for msg in messages:
                    # Check if any message's active_child has the message as its parent
                    if msg.active_child_id and msg.active_child_id in messages_by_id:
                        active_child = messages_by_id[msg.active_child_id]
                        if active_child.parent_id == msg.id:
                            circular_refs.add(msg.id)
                            logger.warning(f"Potential circular reference detected: message {msg.id} has active_child {active_child.id} which points back to it")
                
                if circular_refs:
                    logger.warning(f"Found {len(circular_refs)} messages with potential circular references")
                
                # Return a clean version of messages to avoid serialization issues
                logger.info("Removing circular references for serialization")
                result_messages = []
                for msg in messages:
                    try:
                        # Create a shallow copy using just the basic fields to avoid circular references
                        msg_dict = {
                            "id": msg.id,
                            "conversation_id": msg.conversation_id,
                            "role": msg.role,
                            "content": msg.content,
                            "created_at": msg.created_at,
                            "parent_id": msg.parent_id,
                            "meta_data": msg.meta_data,
                            "block_id": msg.block_id,
                            "active_child_id": msg.active_child_id,
                            "version": msg.version,
                            # Explicitly set these to None to avoid circular references
                            "children": None,
                            "active_child": None
                        }
                        msg_copy = Message(**msg_dict)
                        result_messages.append(msg_copy)
                        logger.debug(f"Successfully processed message {msg.id}")
                    except Exception as copy_error:
                        logger.error(f"Error copying message {msg.id}: {str(copy_error)}")
                
                logger.info(f"Returning {len(result_messages)} messages with circular references removed")
                return result_messages
                
            except Exception as table_error:
                logger.error(f"Error building message tree tables: {str(table_error)}", exc_info=True)
                raise
        except Exception as e:
            logger.error(f"Unexpected error in get_message_tree: {str(e)}", exc_info=True)
            raise
    
    async def send_message(self,
                       background_tasks: BackgroundTasks,
                       conversation_id: str,
                       content: str,
                       parent_id: str,
                       active_thread_ids: List[str],
                       selected_block_id: Optional[str] = None,
                       session: Optional[AsyncSession] = None,
                       message_limit: int = 6) -> Tuple[str, str]:
        """Send a user message and get AI response, incorporating selected block context if provided"""
        logger.info(
            f"Streaming send_message → conv={conversation_id} parent={parent_id} block={selected_block_id}"
        )

        # ── session handling ───────────────────────────────────────────────────────
        managed = session is None
        if managed:
            session = self._create_session()

        # ── 1 conversation / parent checks (same as before) ────────────────────────
        conversation = await self.conversation_repo.get_conversation(conversation_id, session)
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")

        msgs = await self.conversation_repo.get_messages(conversation_id, session)
        if not any(m.id == parent_id for m in msgs):
            raise ValueError(f"Parent {parent_id} not in conversation")

        # ── 2 User message ─────────────────────────────────────────────────────────
        user_msg = await self.conversation_manager.create_user_message(
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=content,
            parent_id=parent_id,
            session=session,
        )

        # ── 3 Assistant placeholder (empty content) ───────────────────────────────
        ai_msg_id = str(uuid.uuid4())
        ai_placeholder = Message(
            id=ai_msg_id,
            conversation_id=conversation_id,
            role=MessageRole.ASSISTANT,
            content="",
            parent_id=user_msg.id,
        )
        await self.conversation_repo.add_message(ai_placeholder, session)

        # ── 4 active‑thread update (user + placeholder) ────────────────────────────
        thread_ids = active_thread_ids + [user_msg.id, ai_msg_id]
        await self.conversation_repo.update_active_thread(conversation_id, thread_ids, session)

        if managed:
            await session.commit()
            await session.close()

        # ── 5 kick off background streaming task ──────────────────────────────────
        background_tasks.add_task(
            self._generate_and_stream_response,
            conversation_id=conversation_id,
            user_msg=user_msg,                      # full object for context building
            ai_msg_id=ai_msg_id,
            initial_active_thread_ids=active_thread_ids + [user_msg.id],
            selected_block_id=selected_block_id,
        )

        # ── 6 return exactly what the frontend expects ─────────────────────────────
        return user_msg.id, ai_msg_id
    
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
                logger.info(f"[Task {ai_msg_id}] Finished LLM stream. Full length: {len(full_response_content)}") 
                # --- Update Placeholder AI Message in DB using new method --- 
                await self.conversation_repo.update_message_content(
                    message_id=ai_msg_id, 
                    new_content=full_response_content, 
                    session=session
                )
                # --- Explicit Commit and Re-fetch within same session ---
                logger.info(f"[Task {ai_msg_id}] Attempting explicit commit...")
                await session.commit()
                logger.info(f"[Task {ai_msg_id}] Explicit commit done. Re-fetching message within same session...")
                committed_message = await self.conversation_repo.get_message(ai_msg_id, session)
                if committed_message:
                    committed_len = len(committed_message.content)
                    committed_snippet = committed_message.content[:100] + ('...' if committed_len > 100 else '')
                    logger.info(f"[Task {ai_msg_id}] Content after commit (same session): Length={committed_len}, Snippet={committed_snippet}")
                else:
                    logger.warning(f"[Task {ai_msg_id}] Could not re-fetch message {ai_msg_id} after commit within the same session.")
                # --------------------------------------------------------
 
                # --- Clean up SSE Stream Queue ---
                await chat_sse_manager.cleanup_stream_queue(ai_msg_id)
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
                # Signal end of stream and clean up queue regardless of success/failure
                await chat_sse_manager.publish_chunk(ai_msg_id, "[DONE]")
                await chat_sse_manager.cleanup_stream_queue(ai_msg_id)
                # The session will be committed/rolled back automatically by the context manager
                logger.info(f"[Task {ai_msg_id}] Background task session closed.")
        
        # === Verification Step: Check DB content *after* task session closes ===
        try:
            async with self.db_session_factory() as verify_session:
                logger.info(f"[Task {ai_msg_id}] Verifying message content in DB...")
                verified_message = await self.conversation_repo.get_message(ai_msg_id, verify_session)
                if verified_message:
                    logger.info(f"[Task {ai_msg_id}] Verified content length: {len(verified_message.content)}")
                    # Log a snippet for sanity check, avoid logging potentially huge content
                    content_snippet = verified_message.content[:100] + ('...' if len(verified_message.content) > 100 else '')
                    logger.info(f"[Task {ai_msg_id}] Verified content snippet: {content_snippet}")
                else:
                    logger.warning(f"[Task {ai_msg_id}] Verification failed: Message {ai_msg_id} not found in DB after task completion.")
        except Exception as verification_err:
            logger.error(f"[Task {ai_msg_id}] Error during post-task verification: {verification_err}", exc_info=True)
        # =======================================================================
        logger.info(f"[Task {ai_msg_id}] Background task fully finished.")
    
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