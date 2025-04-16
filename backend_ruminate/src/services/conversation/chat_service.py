from typing import List, Optional, Tuple
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
from src.services.conversation.conversation_manager import ConversationManager
import re
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

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
                 conversation_manager: ConversationManager):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
        self.llm_service = llm_service
        self.context_service = ContextService(conversation_repository, document_repository)
        self.conversation_manager = conversation_manager
        
    def _create_session(self) -> AsyncSession:
        """Create a new database session"""
        from src.config import get_settings
        settings = get_settings()
        
        if settings.document_storage_type == "rds":
            url = f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
        else:  # sqlite
            url = f"sqlite+aiosqlite:///{settings.db_path}"
            
        engine = create_async_engine(url, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        return async_session()
        
    async def create_conversation(self, document_id: str, session: Optional[AsyncSession] = None) -> Conversation:
        """Create a new conversation (delegated to ConversationManager)"""
        return await self.conversation_manager.create_conversation(
            document_id=document_id,
            session=session,
            template_key="regular_conversation"
        )
    
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
                       conversation_id: str,
                       content: str,
                       parent_id: str,
                       active_thread_ids: List[str],
                       selected_block_id: Optional[str] = None,
                       session: Optional[AsyncSession] = None,
                       message_limit: int = 6) -> Tuple[Message, str]:
        """Send a user message and get AI response, incorporating selected block context if provided"""
        logger.info(f"Sending message to conversation {conversation_id}, selected block: {selected_block_id}, parent: {parent_id}")

        # Track if we need to manage the session ourselves
        managed_session = session is None
        if managed_session:
            session = self._create_session()
        
        try:
            # --- FIRST TRANSACTION: Everything before the LLM call ---
            conversation = await self.conversation_repo.get_conversation(conversation_id, session)
            if not conversation:
                logger.error(f"Conversation {conversation_id} not found")
                raise ValueError(f"Conversation {conversation_id} not found")
            
            # Initialize included_pages if not present
            if not hasattr(conversation, 'included_pages') or conversation.included_pages is None:
                conversation.included_pages = {}
                logger.info(f"Initialized included_pages tracking for conversation {conversation_id}")

            # Verify the provided parent_id
            messages = await self.conversation_repo.get_messages(conversation_id, session)
            if not any(msg.id == parent_id for msg in messages):
                logger.error(f"Parent message {parent_id} not found in conversation {conversation_id}")
                raise ValueError(f"Parent message {parent_id} not found in conversation {conversation_id}")
            
            # Create user message
            user_msg = await self.conversation_manager.create_user_message(
                conversation_id=conversation_id,
                content=content,
                parent_id=parent_id,
                session=session
            )
            
            # Update the active thread
            updated_active_thread_ids = active_thread_ids + [user_msg.id]
            await self.conversation_manager.update_active_thread(conversation_id, updated_active_thread_ids, session)

            # Add specific instruction to the user message
            user_msg.content = "Answer this precisely and accurately, without lists in your answer: " + user_msg.content

            # Build enhanced context
            context_messages, updated_included_pages = await self.context_service.enhance_context_with_block(
                conversation,
                user_msg,
                active_thread_ids,
                selected_block_id,
                session,
                message_limit
            )
            
            # Update conversation if pages were added
            if conversation.included_pages != updated_included_pages:
                conversation.included_pages = updated_included_pages
                await self.conversation_repo.update_conversation(conversation, session)
            
            # Save the first transaction work
            if managed_session:
                await session.commit()
                await session.close()
                logger.info("First transaction committed and closed before LLM call")
            
            # Save IDs we'll need in the second transaction
            user_msg_id = user_msg.id
            
            # --- NO TRANSACTION: LLM API CALL ---
            # This happens outside of any transaction to avoid keeping DB connections open
            logger.info("Calling LLM service outside of transaction")
            
            # Log the user message content being sent to the LLM
            for i, msg in enumerate(context_messages):
                if msg.role == 'user' and i == len(context_messages) - 1:
                    logger.info(f"Final user message content: {msg.content}")
                    
            response_content = await self.llm_service.generate_response(context_messages)
            logger.info("Generated response from LLM")
            
            # --- SECOND TRANSACTION: Everything after the LLM call ---
            # Create a new session if we're managing it
            if managed_session:
                session = self._create_session()
                logger.debug("Started new transaction after LLM call")
            
            try:
                # Create and save AI message
                ai_msg = await self.conversation_manager.create_ai_message(
                    conversation_id=conversation_id,
                    content=response_content,
                    parent_id=user_msg_id,
                    session=session
                )
                
                # Update the active thread to include the AI response
                updated_active_thread_ids = updated_active_thread_ids + [ai_msg.id]
                await self.conversation_manager.update_active_thread(
                    conversation_id, 
                    updated_active_thread_ids, 
                    session
                )
                
                # Commit the second transaction if we're managing it
                if managed_session:
                    await session.commit()
                    logger.debug("Second transaction committed")
                
                return ai_msg, user_msg_id
                
            except Exception as e:
                # Handle errors in second transaction
                if managed_session:
                    await session.rollback()
                logger.error(f"Error in second transaction: {str(e)}")
                raise
        
        except Exception as e:
            # Handle errors in first transaction
            if managed_session and session and session.is_active:
                await session.rollback()
            logger.error(f"Error in first transaction: {str(e)}")
            raise
            
        finally:
            # Always close the session if we created it
            if managed_session and session:
                await session.close()
    
    async def edit_message(self, message_id: str, content: str, active_thread_ids: List[str], session: Optional[AsyncSession] = None) -> Tuple[Message, str]:
        """Edit a message and regenerate the AI response"""
        # Track if we need to manage the session ourselves
        managed_session = session is None
        if managed_session:
            session = self._create_session()
            
        try:
            # --- FIRST TRANSACTION: Everything before the LLM call ---
            # Create new version as sibling
            edited_msg, edited_msg_id = await self.conversation_repo.edit_message(message_id, content, session)
            
            # Update the active thread in the conversation record
            # Instead of updating individual active_child_id pointers, store the complete thread
            updated_active_thread_ids = active_thread_ids + [edited_msg.id]
            await self.conversation_manager.update_active_thread(edited_msg.conversation_id, updated_active_thread_ids, session)

            edited_msg.content = "Answer this precisely and accurately, without lists in your answer:" + edited_msg.content
            
            # Build context using the provided active thread IDs
            context = await self.context_service.build_message_context(
                edited_msg.conversation_id, 
                edited_msg,
                active_thread_ids
            )
            
            # Save important info we'll need after LLM call
            conversation_id = edited_msg.conversation_id
            edited_id = edited_msg.id
            thread_ids = updated_active_thread_ids.copy()
            
            # Commit and close first transaction before LLM call
            if managed_session:
                await session.commit()
                await session.close()
                logger.debug("First transaction committed and closed before LLM call")
            
            # --- NO TRANSACTION: LLM API CALL ---
            logger.debug("Calling LLM service outside of transaction")
            response_content = await self.llm_service.generate_response(context)
            logger.info("Generated response from LLM")
            
            # --- SECOND TRANSACTION: Everything after the LLM call ---
            # Create a new session if we're managing it
            if managed_session:
                session = self._create_session()
                logger.debug("Started new transaction after LLM call")
                
            try:
                # Create new AI response as child of edited message
                ai_msg = await self.conversation_manager.create_ai_message(
                    conversation_id=conversation_id,
                    content=response_content,
                    parent_id=edited_id,
                    session=session
                )
                
                # Update the active thread to include the AI response
                final_thread_ids = thread_ids + [ai_msg.id]
                await self.conversation_manager.update_active_thread(conversation_id, final_thread_ids, session)
                
                # Commit the second transaction if we're managing it
                if managed_session:
                    await session.commit()
                    logger.debug("Second transaction committed")
                
                return ai_msg, edited_msg_id
                
            except Exception as e:
                # Handle errors in second transaction
                if managed_session:
                    await session.rollback()
                logger.error(f"Error in second transaction: {str(e)}")
                raise
                
        except Exception as e:
            # Handle errors in first transaction
            if managed_session and session and session.is_active:
                await session.rollback()
            logger.error(f"Error in first transaction: {str(e)}")
            raise
            
        finally:
            # Always close the session if we created it
            if managed_session and session:
                await session.close()
    
    async def get_message_versions(self, message_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all versions of a message"""
        return await self.conversation_repo.get_message_versions(message_id, session)
    
    async def get_document_conversations(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Conversation]:
        """Get all conversations for a document"""
        return await self.conversation_repo.get_document_conversations(document_id, session)