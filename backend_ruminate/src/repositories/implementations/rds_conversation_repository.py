from typing import List, Optional, Dict, Any, Tuple
import uuid
import json
import logging
from datetime import datetime
from sqlalchemy import select, insert, update, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.conversation.conversation import Conversation, ConversationModel
from src.models.conversation.message import Message, MessageModel, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class RDSConversationRepository(ConversationRepository):
    """PostgreSQL implementation of ConversationRepository using SQLAlchemy."""
    
    def __init__(self, session_factory):
        """Initialize RDS conversation repository.
        
        Args:
            session_factory: SQLAlchemy session factory for database operations
        """
        self.session_factory = session_factory
        
    async def create_conversation(self, conversation: Conversation, session: Optional[AsyncSession] = None) -> Conversation:
        """Create a new conversation"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Convert conversation to dict for insertion
            conv_dict = conversation.model_dump()
            
            # Remove children references - handle separately
            if 'children' in conv_dict:
                conv_dict.pop('children') 
                
            # Check if conversation already exists
            result = await session.execute(
                select(ConversationModel).where(ConversationModel.id == conversation.id)
            )
            existing = result.scalars().first()
            
            if existing:
                # Update existing conversation
                stmt = update(ConversationModel).where(ConversationModel.id == conversation.id).values(**conv_dict)
                await session.execute(stmt)
            else:
                # Insert new conversation
                stmt = insert(ConversationModel).values(**conv_dict)
                await session.execute(stmt)
                
            if local_session:
                await session.commit()
            
            return conversation
        except Exception as e:
            if local_session:
                await session.rollback()
            logger.error(f"Error creating conversation: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def update_conversation(self, conversation: Conversation, session: Optional[AsyncSession] = None) -> Conversation:
        """Update an existing conversation"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Convert conversation to dict for update
            conv_dict = conversation.model_dump()
            
            # Remove complex objects that are stored separately
            if 'children' in conv_dict:
                conv_dict.pop('children')
                
            # Update conversation
            stmt = update(ConversationModel).where(ConversationModel.id == conversation.id).values(**conv_dict)
            await session.execute(stmt)
            
            if local_session:
                await session.commit()
            
            return conversation
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_conversation(self, conversation_id: str, session: Optional[AsyncSession] = None) -> Optional[Conversation]:
        """Get a conversation by ID"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for conversation
            result = await session.execute(
                select(ConversationModel).where(ConversationModel.id == conversation_id)
            )
            conv_model = result.scalars().first()
            
            if not conv_model:
                return None
                
            # Convert model to conversation
            conv_dict = {c.name: getattr(conv_model, c.name) for c in conv_model.__table__.columns}
                
            # Parse datetime string
            if 'created_at' in conv_dict and isinstance(conv_dict['created_at'], str):
                conv_dict['created_at'] = datetime.fromisoformat(conv_dict['created_at'])
                
            return Conversation.from_dict(conv_dict)
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_document_conversations(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Conversation]:
        """Get all conversations for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for conversations
            result = await session.execute(
                select(ConversationModel).where(ConversationModel.document_id == document_id)
            )
            conv_models = result.scalars().all()
            
            # Convert models to conversations
            conversations = []
            for conv_model in conv_models:
                conv_dict = {c.name: getattr(conv_model, c.name) for c in conv_model.__table__.columns}
                
                # Parse datetime string
                if 'created_at' in conv_dict and isinstance(conv_dict['created_at'], str):
                    conv_dict['created_at'] = datetime.fromisoformat(conv_dict['created_at'])
                    
                conversations.append(Conversation.from_dict(conv_dict))
                
            return conversations
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    

    
    async def add_message(self, message: Message, session: Optional[AsyncSession] = None) -> Message:
        """Add a new message to a conversation"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Convert message to dict for insertion
            msg_dict = message.model_dump()
            
            # Remove complex objects that are stored separately
            if 'children' in msg_dict:
                msg_dict.pop('children')
            if 'active_child' in msg_dict:
                msg_dict.pop('active_child')
                
            # Ensure role is stored as string
            if 'role' in msg_dict and not isinstance(msg_dict['role'], str):
                msg_dict['role'] = msg_dict['role'].value
                
            # Format datetime
            if 'created_at' in msg_dict and isinstance(msg_dict['created_at'], datetime):
                msg_dict['created_at'] = msg_dict['created_at'].isoformat()
            
            # Insert the message
            stmt = insert(MessageModel).values(**msg_dict)
            await session.execute(stmt)
            
            # If message has a parent, update parent's active_child_id
            if message.parent_id:
                # Get the parent
                result = await session.execute(
                    select(MessageModel).where(MessageModel.id == message.parent_id)
                )
                parent_model = result.scalars().first()
                
                if parent_model:
                    # Update parent's active_child_id
                    stmt = update(MessageModel).where(
                        MessageModel.id == message.parent_id
                    ).values(
                        active_child_id=message.id
                    )
                    await session.execute(stmt)
                    
            if local_session:
                await session.commit()
                
            return message
        except Exception as e:
            if local_session:
                await session.rollback()
            logger.error(f"Error adding message: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_messages(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all messages for a conversation"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for messages
            result = await session.execute(
                select(MessageModel).where(MessageModel.conversation_id == conversation_id)
            )
            msg_models = result.scalars().all()
            
            # Convert models to messages
            messages = []
            for msg_model in msg_models:
                msg_dict = {c.name: getattr(msg_model, c.name) for c in msg_model.__table__.columns}
                
                # Parse datetime string
                if 'created_at' in msg_dict and isinstance(msg_dict['created_at'], str):
                    msg_dict['created_at'] = datetime.fromisoformat(msg_dict['created_at'])
                    
                messages.append(Message.from_dict(msg_dict))
                
            # Build message tree structure
            message_map = {message.id: message for message in messages}
            
            # Add children to parents
            for message in messages:
                if message.parent_id and message.parent_id in message_map:
                    parent = message_map[message.parent_id]
                    if parent.children is None:
                        parent.children = []
                    parent.children.append(message)
                
                # Set active_child reference
                if message.active_child_id and message.active_child_id in message_map:
                    message.active_child = message_map[message.active_child_id]
            
            return messages
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def edit_message(self, message_id: str, new_content: str, session: Optional[AsyncSession] = None) -> Tuple[Message, str]:
        """Create a new version of a message as a sibling (sharing the same parent)"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Get original message
            result = await session.execute(
                select(MessageModel).where(MessageModel.id == message_id)
            )
            original_model = result.scalars().first()
            
            if not original_model:
                raise ValueError(f"Message {message_id} not found")
                
            # Convert model to message
            original_dict = {c.name: getattr(original_model, c.name) for c in original_model.__table__.columns}
            
            # Parse datetime string
            if 'created_at' in original_dict and isinstance(original_dict['created_at'], str):
                original_dict['created_at'] = datetime.fromisoformat(original_dict['created_at'])
                
            original_msg = Message.from_dict(original_dict)
            
            logger.debug(f"Original message: {original_msg.id}, parent_id: {original_msg.parent_id}")
            
            # Create new version with same parent
            new_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=original_msg.conversation_id,
                role=original_msg.role,
                content=new_content,
                parent_id=original_msg.parent_id,
                meta_data=original_msg.meta_data,
                block_id=original_msg.block_id,
                created_at=datetime.utcnow()
            )
            logger.debug(f"Created new version: {new_msg.id}, parent_id: {new_msg.parent_id}")
            
            # Add new message
            await self.add_message(new_msg, session)
            
            # Update parent's active_child_id to point to new version
            if new_msg.parent_id:
                await self.set_active_version(new_msg.parent_id, new_msg.id, session)
                logger.debug(f"Set parent {new_msg.parent_id} active_child_id to {new_msg.id}")
            
            if local_session:
                await session.commit()
                
            return new_msg, new_msg.id
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()

    async def get_message(self, message_id: str, session: Optional[AsyncSession] = None) -> Optional[Message]:
        """Get a message by ID"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for message
            result = await session.execute(
                select(MessageModel).where(MessageModel.id == message_id)
            )
            msg_model = result.scalars().first()
            
            if not msg_model:
                return None
                
            # Convert model to message
            msg_dict = {c.name: getattr(msg_model, c.name) for c in msg_model.__table__.columns}
                
            # Parse datetime string
            if 'created_at' in msg_dict and isinstance(msg_dict['created_at'], str):
                msg_dict['created_at'] = datetime.fromisoformat(msg_dict['created_at'])
                
            return Message.from_dict(msg_dict)
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_message_versions(self, message_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all versions of a message (original + edited versions)"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Start with the requested message
            result = await session.execute(
                select(MessageModel).where(MessageModel.id == message_id)
            )
            current_model = result.scalars().first()
            
            if not current_model:
                return []
                
            # Convert model to message
            current_dict = {c.name: getattr(current_model, c.name) for c in current_model.__table__.columns}
            
            # Parse datetime string
            if 'created_at' in current_dict and isinstance(current_dict['created_at'], str):
                current_dict['created_at'] = datetime.fromisoformat(current_dict['created_at'])
                
            current_msg = Message.from_dict(current_dict)
            logger.debug(f"Current message: {current_msg.id}, parent_id: {current_msg.parent_id}, role: {current_msg.role}")
            
            # Get all messages with same parent_id as this message (siblings)
            # OR if this is the original message
            if current_msg.parent_id:
                result = await session.execute(
                    select(MessageModel).where(
                        (MessageModel.parent_id == current_msg.parent_id) | 
                        (MessageModel.id == message_id)
                    ).order_by(MessageModel.created_at)
                )
            else:
                # This is a root message, return only this message
                return [current_msg]
                
            msg_models = result.scalars().all()
            
            # Convert models to messages
            versions = []
            for msg_model in msg_models:
                msg_dict = {c.name: getattr(msg_model, c.name) for c in msg_model.__table__.columns}
                
                # Parse datetime string
                if 'created_at' in msg_dict and isinstance(msg_dict['created_at'], str):
                    msg_dict['created_at'] = datetime.fromisoformat(msg_dict['created_at'])
                    
                versions.append(Message.from_dict(msg_dict))
                
            logger.debug(f"Found {len(versions)} versions:")
            for v in versions:
                logger.debug(f"  - {v.id} (parent: {v.parent_id}, role: {v.role})")
                
            return versions
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_message_tree(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all messages in a conversation as a tree structure, including versions and branches"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Get all messages for the conversation
            messages = await self.get_messages(conversation_id, session)
            
            # Get the conversation record to access active_thread_ids
            result = await session.execute(
                select(ConversationModel).where(ConversationModel.id == conversation_id)
            )
            conversation_model = result.scalars().first()
            
            # Get active thread IDs from conversation model
            active_thread_ids = []
            if conversation_model and hasattr(conversation_model, 'active_thread_ids'):
                active_thread_ids = conversation_model.active_thread_ids or []
                
            # Create a map of messages by ID for easy access
            messages_by_id = {msg.id: msg for msg in messages}
            
            # Set active_child_id pointers based on active_thread_ids
            # This ensures the frontend can still traverse the tree using active_child_id
            if len(active_thread_ids) >= 2:
                for i in range(len(active_thread_ids) - 1):
                    parent_id = active_thread_ids[i]
                    child_id = active_thread_ids[i + 1]
                    
                    if parent_id in messages_by_id:
                        # Set active_child_id on the parent message to point to its child in the active thread
                        messages_by_id[parent_id].active_child_id = child_id
                        
                        logger.debug(f"Set active_child_id of {parent_id} to {child_id} for frontend compatibility")
                
            # Add a log message to help with debugging
            logger.debug(f"Returning message tree for conversation {conversation_id} with {len(messages)} messages, {len(active_thread_ids)} in active thread")
            
            return messages
        except Exception as e:
            logger.error(f"Error retrieving message tree: {str(e)}")
            if local_session:
                await session.close()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def set_active_version(self, parent_id: str, child_id: str, session: Optional[AsyncSession] = None) -> None:
        """Set a message's active child version"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Update parent's active_child_id
            stmt = update(MessageModel).where(
                MessageModel.id == parent_id
            ).values(
                active_child_id=child_id
            )
            await session.execute(stmt)
            
            if local_session:
                await session.commit()
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
                
    async def update_active_thread(self, conversation_id: str, active_thread_ids: List[str], session: Optional[AsyncSession] = None) -> None:
        """Update the active thread IDs in the conversation record
        
        This stores the complete ordered list of message IDs representing the active thread
        in the conversation record, rather than using active_child_id pointers.
        """
        if not active_thread_ids:
            logger.warning(f"Empty active_thread_ids provided for conversation {conversation_id}")
            return
            
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Get messages to verify they exist and belong to this conversation
            result = await session.execute(
                select(MessageModel).where(
                    MessageModel.id.in_(active_thread_ids),
                    MessageModel.conversation_id == conversation_id
                )
            )
            message_models = result.scalars().all()
            
            # Create a set of message IDs for quick lookup
            message_ids = {msg.id for msg in message_models}
            
            # Check if all provided IDs exist in this conversation
            if len(message_ids) != len(active_thread_ids):
                missing_ids = set(active_thread_ids) - message_ids
                logger.warning(f"Some messages in active_thread_ids not found: {missing_ids}")
                # Filter out any IDs that don't exist
                active_thread_ids = [id for id in active_thread_ids if id in message_ids]
            
            # Update the conversation record with the active thread IDs
            stmt = update(ConversationModel).where(
                ConversationModel.id == conversation_id
            ).values(
                active_thread_ids=active_thread_ids
            )
            await session.execute(stmt)
            
            if local_session:
                await session.commit()
                
            logger.info(f"Updated active thread for conversation {conversation_id}")
            
        except Exception as e:
            if local_session:
                await session.rollback()
            logger.error(f"Error updating active thread: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_active_thread(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get the active thread of messages in a conversation
        
        Uses the stored active_thread_ids list from the conversation record to retrieve
        messages in the correct order, rather than traversing active_child_id pointers.
        """
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Get conversation to get the active thread IDs
            result = await session.execute(
                select(ConversationModel).where(ConversationModel.id == conversation_id)
            )
            conversation_model = result.scalars().first()
            
            if not conversation_model:
                logger.warning(f"Conversation {conversation_id} not found")
                return []
                
            # Get active thread IDs from conversation
            active_thread_ids = conversation_model.active_thread_ids or []
            
            # If active_thread_ids is empty but we have a root_message_id, use that as a fallback
            if not active_thread_ids and conversation_model.root_message_id:
                active_thread_ids = [conversation_model.root_message_id]
                
            if not active_thread_ids:
                return []
                
            # Fetch all messages in the active thread
            result = await session.execute(
                select(MessageModel).where(
                    MessageModel.id.in_(active_thread_ids)
                )
            )
            message_models = result.scalars().all()
            
            # Convert models to messages and sort in the same order as active_thread_ids
            messages_by_id = {}
            for model in message_models:
                msg_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Parse datetime string
                if 'created_at' in msg_dict and isinstance(msg_dict['created_at'], str):
                    msg_dict['created_at'] = datetime.fromisoformat(msg_dict['created_at'])
                    
                messages_by_id[model.id] = Message.from_dict(msg_dict)
                
            # Return messages in the correct order from active_thread_ids
            messages = [messages_by_id[id] for id in active_thread_ids if id in messages_by_id]
            
            logger.debug(f"Retrieved active thread for conversation {conversation_id} with {len(messages)} messages")
            return messages
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()

    async def get_conversations_by_criteria(self, criteria: Dict[str, Any], session: Optional[AsyncSession] = None) -> List[Conversation]:
        """Get conversations matching the provided criteria"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Build query with dynamic criteria
            query = select(ConversationModel)
            
            # Add all criteria as filters
            for key, value in criteria.items():
                if hasattr(ConversationModel, key):
                    query = query.where(getattr(ConversationModel, key) == value)
            
            # Execute query
            result = await session.execute(query)
            models = result.scalars().all()
            
            # Convert to Conversation objects
            conversations = []
            for model in models:
                # Convert model to dict
                conv_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Parse created_at datetime if it's a string
                if 'created_at' in conv_dict and isinstance(conv_dict['created_at'], str):
                    conv_dict['created_at'] = datetime.fromisoformat(conv_dict['created_at'])
                
                # Convert included_pages from JSON to dict if needed
                if 'included_pages' in conv_dict and conv_dict['included_pages'] is not None:
                    if isinstance(conv_dict['included_pages'], str):
                        conv_dict['included_pages'] = json.loads(conv_dict['included_pages'])
                
                conversations.append(Conversation.from_dict(conv_dict))
            
            return conversations
        except Exception as e:
            if local_session:
                await session.rollback()
            logger.error(f"Error in get_conversations_by_criteria: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
