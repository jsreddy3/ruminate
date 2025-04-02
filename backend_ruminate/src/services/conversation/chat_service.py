from typing import List, Optional, Tuple
from src.models.conversation.conversation import Conversation, ConversationType
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.repositories.interfaces.insight_repository import InsightRepository
from src.services.ai.llm_service import LLMService
from src.services.ai.context_service import ContextService
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import json
from datetime import datetime

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
                 insight_repository: InsightRepository,
                 llm_service: LLMService):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
        self.insight_repository = insight_repository
        self.llm_service = llm_service
        self.context_service = ContextService(conversation_repository, document_repository)
    
    async def create_conversation(self, document_id: str, block_id: Optional[str] = None, session: Optional[AsyncSession] = None) -> Conversation:
        """Create a new conversation"""
        # Verify document exists
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Create conversation
        conversation = Conversation(
            document_id=document_id,
            block_id=block_id,
            type=ConversationType.BLOCK if block_id else ConversationType.MAIN
        )
        conversation = await self.conversation_repo.create_conversation(conversation, session)
        
        # Create system message with document/block context
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")
            
        # Build system message content
        content = f"This is a conversation about the document: {document.title}\n"
        # Add document summary if available
        if document.summary:
            content += f"\nDocument Summary:\n{document.summary}\n"
        
        # Add block context if this is a block conversation
        if block_id:
            block = await self.document_repo.get_block(block_id, session)
            if block:
                content += f"\nSpecifically about this section:\n{block.html_content}"
        
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
        
        # If this is a block conversation, add the rumination insight as context
        if block_id:
            insight = await self.insight_repository.get_block_insight(block_id)
            if insight and insight.conversation_history:
                # Add each message from the rumination history
                for msg in insight.conversation_history:
                    message = Message(
                        id=str(uuid.uuid4()),
                        conversation_id=conversation.id,
                        role=msg["role"],
                        content=msg["content"]
                    )
                    await self.conversation_repo.add_message(message, session)
        
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
    
    async def send_message(self, conversation_id: str, content: str, parent_version_id: Optional[str] = None, session: Optional[AsyncSession] = None) -> Tuple[Message, str]:
        """Send a user message and get AI response"""
        logger.info(f"Sending message to conversation {conversation_id}")
        
        # Get conversation to verify it exists
        conversation = await self.conversation_repo.get_conversation(conversation_id, session)
        logger.info(f"Retrieved conversation: {conversation}")
        if not conversation:
            logger.error(f"Conversation {conversation_id} not found")
            raise ValueError(f"Conversation {conversation_id} not found")

        # Get current thread to find parent
        thread = await self.conversation_repo.get_active_thread(conversation_id, session)
        logger.info(f"Retrieved thread with {len(thread) if thread else 0} messages")
        logger.info(f"Thread messages: {[msg.content for msg in thread] if thread else []}")

        # If parent_version_id is provided, verify it exists and use it as parent
        parent_id = None
        if parent_version_id:
            # Find the message in the thread that has this version ID
            parent_msg = next((msg for msg in thread if msg.id == parent_version_id), None)
            if not parent_msg:
                logger.error(f"Parent version {parent_version_id} not found")
                raise ValueError(f"Parent version {parent_version_id} not found")
            parent_id = parent_version_id
        else:
            # Use the last message in thread as parent
            parent_id = thread[-1].id if thread else None

        # Create user message with parent set to specified version or last message
        try:
            user_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                role=MessageRole.USER,
                content=content,
                parent_id=parent_id
            )
            logger.info(f"Created user message: {user_msg}")
        except Exception as e:
            logger.error(f"Error creating user message: {e}")
            raise ValueError(f"Error creating user message: {e}")
        
        # Save user message
        try:
            await self.conversation_repo.add_message(user_msg, session)
            logger.info("Saved user message")
        except Exception as e:
            logger.error(f"Error saving user message: {e}")
            raise ValueError(f"Error saving user message: {e}")
        
        # Set parent's active_child_id to user message
        if user_msg.parent_id:
            try:
                await self.conversation_repo.set_active_version(user_msg.parent_id, user_msg.id, session)
                logger.info("Set active version")
            except Exception as e:
                logger.error(f"Error setting active version: {e}")
                raise ValueError(f"Error setting active version: {e}")
        
        # Build context and generate response
        try:
            context = await self.context_service.build_message_context(conversation_id, user_msg)
            logger.info(f"Built context with {len(context)} messages")
            response_content = await self.llm_service.generate_response(context)
            logger.info("Generated response")
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            raise ValueError(f"Error generating response: {e}")
        
        # Create AI response with parent set to user message
        try:
            ai_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT,
                content=response_content,
                parent_id=user_msg.id
            )
            logger.info("Created AI message")
        except Exception as e:
            logger.error(f"Error creating AI message: {e}")
            raise ValueError(f"Error creating AI message: {e}")
        
        # Save AI message
        try:
            await self.conversation_repo.add_message(ai_msg, session)
            logger.info("Saved AI message")
        except Exception as e:
            logger.error(f"Error saving AI message: {e}")
            raise ValueError(f"Error saving AI message: {e}")
        
        # Set user message's active_child_id to AI message
        try:
            await self.conversation_repo.set_active_version(user_msg.id, ai_msg.id, session)
            logger.info("Set active version for AI message")
        except Exception as e:
            logger.error(f"Error setting active version for AI message: {e}")
            raise ValueError(f"Error setting active version for AI message: {e}")
        
        return ai_msg, user_msg.id
    
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
    
    async def get_block_conversations(self, block_id: str, session: Optional[AsyncSession] = None) -> List[Conversation]:
        """Get all conversations for a block"""
        return await self.conversation_repo.get_block_conversations(block_id, session)