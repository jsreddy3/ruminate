from typing import List, Optional, Dict, Any, Tuple
import aiosqlite
import sqlite3
import json
import os
import logging
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message
from src.repositories.interfaces.conversation_repository import ConversationRepository

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class SQLiteConversationRepository(ConversationRepository):
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._ensure_db()
    
    def _ensure_db(self):
        """Create database and tables if they don't exist."""
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
            
        with sqlite3.connect(self.db_path) as db:
            # Conversations table
            db.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    root_message_id TEXT,
                    data TEXT NOT NULL
                )
            """)
            
            # Messages table with tree structure
            db.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    parent_id TEXT,
                    active_child_id TEXT,
                    data TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
                    FOREIGN KEY (parent_id) REFERENCES messages(id),
                    FOREIGN KEY (active_child_id) REFERENCES messages(id)
                )
            """)
            db.commit()
    
    async def create_conversation(self, conversation: Conversation, session: Optional[AsyncSession] = None) -> Conversation:
        # logger.debug(f"Creating conversation with ID: {conversation.id}")
        # logger.debug(f"Conversation data: {conversation.model_dump()}")
        
        if session:
            # logger.debug("Using SQLAlchemy session")
            await session.execute(
                text("INSERT INTO conversations (id, document_id, root_message_id, data) VALUES (:id, :document_id, :root_message_id, :data)"),
                {
                    "id": conversation.id,
                    "document_id": conversation.document_id,
                    "root_message_id": conversation.root_message_id,
                    "data": json.dumps(conversation.model_dump())
                }
            )
            await session.commit()
            return conversation

        # logger.debug("Using aiosqlite connection")
        async with aiosqlite.connect(self.db_path) as db:
            try:
                await db.execute(
                    "INSERT INTO conversations (id, document_id, root_message_id, data) VALUES (?, ?, ?, ?)",
                    (conversation.id, conversation.document_id, conversation.root_message_id, json.dumps(conversation.model_dump()))
                )
                await db.commit()
                # logger.debug("Successfully created conversation")
                return conversation
            except Exception as e:
                # logger.error(f"Error creating conversation: {str(e)}")
                raise
    
    async def add_message(self, message: Message, session: Optional[AsyncSession] = None) -> Message:
        if session:
            # First add the message
            await session.execute(
                text("INSERT INTO messages (id, conversation_id, parent_id, active_child_id, data) VALUES (:id, :conversation_id, :parent_id, :active_child_id, :data)"),
                {
                    "id": message.id,
                    "conversation_id": message.conversation_id,
                    "parent_id": message.parent_id,
                    "active_child_id": message.active_child_id,
                    "data": json.dumps(message.model_dump())
                }
            )
            
            # If message has a parent, add it to parent's children list and set as active child
            if message.parent_id:
                result = await session.execute(
                    text("SELECT data FROM messages WHERE id = :id"),
                    {"id": message.parent_id}
                )
                row = result.fetchone()
                if row:
                    parent = Message.from_dict(json.loads(row[0]))
                    if parent.children is None:
                        parent.children = []
                    parent.children.append(message)
                    parent.active_child_id = message.id  # Set as active child
                    await session.execute(
                        text("UPDATE messages SET data = :data, active_child_id = :active_child_id WHERE id = :id"),
                        {
                            "id": parent.id,
                            "data": json.dumps(parent.model_dump()),
                            "active_child_id": message.id
                        }
                    )
            await session.commit()
            return message

        async with aiosqlite.connect(self.db_path) as db:
            # First add the message
            await db.execute(
                "INSERT INTO messages (id, conversation_id, parent_id, active_child_id, data) VALUES (?, ?, ?, ?, ?)",
                (message.id, message.conversation_id, message.parent_id, message.active_child_id, json.dumps(message.model_dump()))
            )
            
            # If message has a parent, add it to parent's children list and set as active child
            if message.parent_id:
                async with db.execute(
                    "SELECT data FROM messages WHERE id = ?",
                    (message.parent_id,)
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        parent = Message.from_dict(json.loads(row[0]))
                        if parent.children is None:
                            parent.children = []
                        parent.children.append(message)
                        parent.active_child_id = message.id  # Set as active child
                        await db.execute(
                            "UPDATE messages SET data = ?, active_child_id = ? WHERE id = ?",
                            (json.dumps(parent.model_dump()), message.id, parent.id)
                        )
            await db.commit()
            return message
    
    async def edit_message(self, message_id: str, new_content: str, session: Optional[AsyncSession] = None) -> Tuple[Message, str]:
        """Create a new version of a message as a sibling (sharing the same parent)"""
        # Get original message
        original_msg = None
        if session:
            result = await session.execute(
                text("SELECT data FROM messages WHERE id = :id"),
                {"id": message_id}
            )
            row = result.fetchone()
            if row:
                original_msg = Message.from_dict(json.loads(row[0]))
        else:
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT data FROM messages WHERE id = ?",
                    (message_id,)
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        original_msg = Message.from_dict(json.loads(row[0]))
        
        if not original_msg:
            raise ValueError(f"Message {message_id} not found")
        
        logger.debug(f"Original message: {original_msg.id}, parent_id: {original_msg.parent_id}")
        
        # Create new version with same parent
        new_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=original_msg.conversation_id,
            role=original_msg.role,
            content=new_content,
            parent_id=original_msg.parent_id,
            meta_data=original_msg.meta_data
        )
        logger.debug(f"Created new version: {new_msg.id}, parent_id: {new_msg.parent_id}")
        
        # Add new message (parent's children list will be updated in add_message)
        await self.add_message(new_msg)
        
        # Update parent's active_child_id to point to new version
        if new_msg.parent_id:
            await self.set_active_version(new_msg.parent_id, new_msg.id)
            logger.debug(f"Set parent {new_msg.parent_id} active_child_id to {new_msg.id}")
            
            # Also update parent message object in memory
            if session:
                result = await session.execute(
                    text("SELECT data FROM messages WHERE id = :id"),
                    {"id": new_msg.parent_id}
                )
                row = result.fetchone()
                if row:
                    parent = Message.from_dict(json.loads(row[0]))
                    parent.active_child_id = new_msg.id
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    async with db.execute(
                        "SELECT data FROM messages WHERE id = ?",
                        (new_msg.parent_id,)
                    ) as cursor:
                        row = await cursor.fetchone()
                        if row:
                            parent = Message.from_dict(json.loads(row[0]))
                            parent.active_child_id = new_msg.id
        
        return new_msg, new_msg.id
    
    async def get_message_versions(self, message_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all versions of a message (original + edited versions)."""
        if session:
            # Start with the requested message
            result = await session.execute(
                text("SELECT data FROM messages WHERE id = :id"),
                {"id": message_id}
            )
            row = result.fetchone()
            if not row:
                return []
            
            current_msg = Message.from_dict(json.loads(row[0]))
            logger.debug(f"Current message: {current_msg.id}, parent_id: {current_msg.parent_id}, role: {current_msg.role}")
            
            # Get all messages with same parent_id as this message (siblings)
            # OR all messages that have this message as their parent_id
            result = await session.execute(
                text("""
                    SELECT data FROM messages 
                    WHERE (parent_id = :parent_id AND parent_id IS NOT NULL)  -- Get siblings
                    OR id = :message_id  -- Include the original message
                    ORDER BY json_extract(data, '$.created_at')
                """),
                {"parent_id": current_msg.parent_id, "message_id": message_id}
            )
            rows = result.fetchall()
            versions = [Message.from_dict(json.loads(row[0])) for row in rows]
            logger.debug(f"Found {len(versions)} versions:")
            for v in versions:
                logger.debug(f"  - {v.id} (parent: {v.parent_id}, role: {v.role})")
            
            return versions

        async with aiosqlite.connect(self.db_path) as db:
            # Start with the requested message
            async with db.execute(
                "SELECT data FROM messages WHERE id = ?",
                (message_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return []
                
                current_msg = Message.from_dict(json.loads(row[0]))
                logger.debug(f"Current message: {current_msg.id}, parent_id: {current_msg.parent_id}, role: {current_msg.role}")
                
                # Get all messages with same parent_id as this message (siblings)
                # OR all messages that have this message as their parent_id
                async with db.execute(
                    """
                    SELECT data FROM messages 
                    WHERE (parent_id = ? AND parent_id IS NOT NULL)  -- Get siblings
                    OR id = ?  -- Include the original message
                    ORDER BY json_extract(data, '$.created_at')
                    """,
                    (current_msg.parent_id, message_id)
                ) as cursor:
                    rows = await cursor.fetchall()
                    versions = [Message.from_dict(json.loads(row[0])) for row in rows]
                    logger.debug(f"Found {len(versions)} versions:")
                    for v in versions:
                        logger.debug(f"  - {v.id} (parent: {v.parent_id}, role: {v.role})")
                
                return versions
    
    async def get_conversation(self, conversation_id: str, session: Optional[AsyncSession] = None) -> Optional[Conversation]:
        if session:
            result = await session.execute(
                text("SELECT data FROM conversations WHERE id = :id"),
                {"id": conversation_id}
            )
            row = result.fetchone()
            if row:
                data = json.loads(row[0])
                return Conversation.from_dict(data)
            return None

        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM conversations WHERE id = ?",
                (conversation_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    data = json.loads(row[0])
                    return Conversation.from_dict(data)
        return None
    
    
    async def get_active_thread(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        # Get conversation to find root message
        conversation = await self.get_conversation(conversation_id)
        if not conversation:
            return []
        
        # If conversation has no root message, return empty list
        if not conversation.root_message_id:
            return []
        
        messages = []
        current_id = conversation.root_message_id

        if session:
            while current_id:
                result = await session.execute(
                    text("SELECT data, active_child_id FROM messages WHERE id = :id"),
                    {"id": current_id}
                )
                row = result.fetchone()
                if not row:
                    break
                
                data = json.loads(row[0])
                messages.append(Message.from_dict(data))
                current_id = row[1]  # active_child_id
            return messages
        
        async with aiosqlite.connect(self.db_path) as db:
            while current_id:
                async with db.execute(
                    "SELECT data, active_child_id FROM messages WHERE id = ?",
                    (current_id,)
                ) as cursor:
                    row = await cursor.fetchone()
                    if not row:
                        break
                    
                    data = json.loads(row[0])
                    messages.append(Message.from_dict(data))
                    current_id = row[1]  # active_child_id
        for i in range(len(messages)):
            logger.debug(f"Message {i}: {messages[i].content}")
        return messages
    
    async def set_active_version(self, parent_id: str, child_id: str, session: Optional[AsyncSession] = None) -> None:
        """Set a message's active child version"""
        if session:
            # Update the active_child_id in the messages table
            await session.execute(
                text("UPDATE messages SET active_child_id = :child_id WHERE id = :parent_id"),
                {"parent_id": parent_id, "child_id": child_id}
            )
            
            # Also update the active_child_id in the message data
            result = await session.execute(
                text("SELECT data FROM messages WHERE id = :id"),
                {"id": parent_id}
            )
            row = result.fetchone()
            if row:
                parent = Message.from_dict(json.loads(row[0]))
                parent.active_child_id = child_id
                await session.execute(
                    text("UPDATE messages SET data = :data WHERE id = :id"),
                    {
                        "id": parent_id,
                        "data": json.dumps(parent.model_dump())
                    }
                )
            await session.commit()
            return

        async with aiosqlite.connect(self.db_path) as db:
            # Update the active_child_id in the messages table
            await db.execute(
                "UPDATE messages SET active_child_id = ? WHERE id = ?",
                (child_id, parent_id)
            )
            
            # Also update the active_child_id in the message data
            async with db.execute(
                "SELECT data FROM messages WHERE id = ?",
                (parent_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    parent = Message.from_dict(json.loads(row[0]))
                    parent.active_child_id = child_id
                    await db.execute(
                        "UPDATE messages SET data = ? WHERE id = ?",
                        (json.dumps(parent.model_dump()), parent_id)
                    )
            await db.commit()
    
    async def get_document_conversations(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Conversation]:
        """Get all conversations for a document from SQLite."""
        if session:
            result = await session.execute(
                text("SELECT data FROM conversations WHERE document_id = :doc_id"),
                {"doc_id": document_id}
            )
            conversations = []
            for row in result:
                data = json.loads(row[0])
                conversations.append(Conversation.from_dict(data))
            return conversations
            
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM conversations WHERE document_id = ?",
                (document_id,)
            ) as cursor:
                conversations = []
                async for row in cursor:
                    data = json.loads(row[0])
                    conversations.append(Conversation.from_dict(data))
                return conversations
    
    async def get_messages(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all messages in a conversation from SQLite."""
        if session:
            result = await session.execute(
                text("SELECT data FROM messages WHERE conversation_id = :conv_id"),
                {"conv_id": conversation_id}
            )
            messages = []
            for row in result:
                data = json.loads(row[0])
                messages.append(Message.from_dict(data))
            return messages
            
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM messages WHERE conversation_id = ?",
                (conversation_id,)
            ) as cursor:
                messages = []
                async for row in cursor:
                    data = json.loads(row[0])
                    messages.append(Message.from_dict(data))
                return messages
    
    async def update_conversation(self, conversation: Conversation, session: Optional[AsyncSession] = None) -> Conversation:
        """Update an existing conversation"""
        if session:
            await session.execute(
                text("UPDATE conversations SET document_id = :document_id, root_message_id = :root_message_id, data = :data WHERE id = :id"),
                {
                    "id": conversation.id,
                    "document_id": conversation.document_id,
                    "root_message_id": conversation.root_message_id,
                    "data": json.dumps(conversation.model_dump())
                }
            )
            await session.commit()
            return conversation

        async with aiosqlite.connect(self.db_path) as db:
            try:
                await db.execute(
                    "UPDATE conversations SET document_id = ?, root_message_id = ?, data = ? WHERE id = ?",
                    (conversation.document_id, conversation.root_message_id, json.dumps(conversation.model_dump()), conversation.id)
                )
                await db.commit()
                return conversation
            except Exception as e:
                raise

    async def get_message_tree(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Message]:
        """Get all messages in a conversation as a tree structure, including versions and branches"""
        # Since our tree structure is maintained through parent_id and active_child_id links,
        # we can simply return all messages for the conversation
        return await self.get_messages(conversation_id, session)
