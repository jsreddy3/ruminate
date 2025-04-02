from typing import List, Dict, Optional, TypeVar
import json
import os
from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message
from src.repositories.interfaces.conversation_repository import ConversationRepository

DBSession = TypeVar('DBSession')

class JSONConversationRepository(ConversationRepository):
    def __init__(self, data_dir: str = "local_db"):
        self.data_dir = data_dir
        self._ensure_dirs()
        
        # In-memory stores for quick access
        self.conversations: Dict[str, Conversation] = {}
        self.messages: Dict[str, Dict[str, Message]] = {}  # conversation_id -> {message_id -> Message}
    
    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "conversations"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "messages"), exist_ok=True)
    
    def _load_messages(self, conversation_id: str) -> Dict[str, Message]:
        """Load all messages for a conversation into memory"""
        if conversation_id in self.messages:
            return self.messages[conversation_id]
            
        path = os.path.join(self.data_dir, "messages", f"{conversation_id}.json")
        if os.path.exists(path):
            with open(path, 'r') as f:
                messages_data = json.load(f)
                messages = {
                    data['id']: Message.from_dict(data)
                    for data in messages_data
                }
                self.messages[conversation_id] = messages
                return messages
        return {}
    
    def _save_messages(self, conversation_id: str):
        """Save all messages for a conversation to disk"""
        if conversation_id not in self.messages:
            return
            
        path = os.path.join(self.data_dir, "messages", f"{conversation_id}.json")
        messages_data = [
            msg.to_dict() 
            for msg in self.messages[conversation_id].values()
        ]
        with open(path, 'w') as f:
            json.dump(messages_data, f)
    
    async def create_conversation(self, conversation: Conversation, session: Optional[DBSession] = None) -> Conversation:
        self.conversations[conversation.id] = conversation
        path = os.path.join(self.data_dir, "conversations", f"{conversation.id}.json")
        with open(path, 'w') as f:
            json.dump(conversation.to_dict(), f)
        return conversation
    
    async def get_conversation(self, conversation_id: str, session: Optional[DBSession] = None) -> Optional[Conversation]:
        if conversation_id in self.conversations:
            return self.conversations[conversation_id]
            
        path = os.path.join(self.data_dir, "conversations", f"{conversation_id}.json")
        if os.path.exists(path):
            with open(path, 'r') as f:
                data = json.load(f)
                conv = Conversation.from_dict(data)
                self.conversations[conversation_id] = conv
                return conv
        return None
    
    async def get_document_conversations(self, document_id: str, session: Optional[DBSession] = None) -> List[Conversation]:
        conversations = []
        conv_dir = os.path.join(self.data_dir, "conversations")
        for filename in os.listdir(conv_dir):
            if filename.endswith('.json'):
                path = os.path.join(conv_dir, filename)
                with open(path, 'r') as f:
                    data = json.load(f)
                    if data.get('document_id') == document_id:
                        conv = Conversation.from_dict(data)
                        self.conversations[conv.id] = conv
                        conversations.append(conv)
        return sorted(conversations, key=lambda x: x.created_at, reverse=True)
    
    async def add_message(self, message: Message, session: Optional[DBSession] = None) -> Message:
        if message.conversation_id not in self.messages:
            self.messages[message.conversation_id] = {}
        
        # Add message to memory
        self.messages[message.conversation_id][message.id] = message
        
        # If this message has a parent, add it to parent's children list and set as active child
        if message.parent_id and message.parent_id in self.messages[message.conversation_id]:
            parent = self.messages[message.conversation_id][message.parent_id]
            if parent.children is None:
                parent.children = []
            parent.children.append(message)
            parent.active_child_id = message.id  # Set as active child
        
        # Save to disk
        self._save_messages(message.conversation_id)
        return message
    
    async def get_messages(self, conversation_id: str, session: Optional[DBSession] = None) -> List[Message]:
        messages = list(self._load_messages(conversation_id).values())
        return sorted(messages, key=lambda x: x.created_at)
    
    async def get_block_conversations(self, block_id: str, session: Optional[DBSession] = None) -> List[Conversation]:
        conversations = []
        conv_dir = os.path.join(self.data_dir, "conversations")
        for filename in os.listdir(conv_dir):
            if filename.endswith('.json'):
                path = os.path.join(conv_dir, filename)
                with open(path, 'r') as f:
                    data = json.load(f)
                    if data.get('block_id') == block_id:
                        conv = Conversation.from_dict(data)
                        self.conversations[conv.id] = conv
                        conversations.append(conv)
        return sorted(conversations, key=lambda x: x.created_at, reverse=True)
    
    async def edit_message(self, message_id: str, new_content: str, session: Optional[DBSession] = None) -> Message:
        """Create a new version of a message as a sibling (sharing the same parent)"""
        # Find the message
        for conv_id, messages in self.messages.items():
            if message_id in messages:
                original = messages[message_id]
                
                # Create sibling (copy with same parent)
                new_message = Message(
                    conversation_id=original.conversation_id,
                    role=original.role,
                    content=new_content,
                    parent_id=original.parent_id,  # Same parent as original
                    block_id=original.block_id
                )
                
                # Add new message
                await self.add_message(new_message)
                return new_message
                
        raise ValueError(f"Message {message_id} not found")
    
    async def get_message_versions(self, message_id: str, session: Optional[DBSession] = None) -> List[Message]:
        # Find the message
        for messages in self.messages.values():
            if message_id in messages:
                message = messages[message_id]
                if not message.parent_id:
                    return []
                    
                # Get all siblings (messages with same parent)
                return [
                    msg for msg in messages.values()
                    if msg.parent_id == message.parent_id
                ]
                
        return []
    
    async def get_active_thread(self, conversation_id: str, session: Optional[DBSession] = None) -> List[Message]:
        conversation = await self.get_conversation(conversation_id)
        if not conversation or not conversation.root_message_id:
            return []
            
        messages = self._load_messages(conversation_id)
        if not messages:
            return []
            
        thread = []
        current_id = conversation.root_message_id
        
        while current_id and current_id in messages:
            current = messages[current_id]
            thread.append(current)
            current_id = current.active_child_id
            
        return thread
    
    async def set_active_version(self, message_id: str, version_id: str, session: Optional[DBSession] = None) -> None:
        # Find the messages
        for conv_id, messages in self.messages.items():
            if message_id in messages and version_id in messages:
                message = messages[message_id]
                version = messages[version_id]
                
                # Verify they share the same parent
                if not message.parent_id or message.parent_id != version.parent_id:
                    raise ValueError("Invalid message versions")
                    
                # Update parent's active child
                if message.parent_id in messages:
                    parent = messages[message.parent_id]
                    parent.active_child_id = version_id
                    self._save_messages(conv_id)
                    return
                    
        raise ValueError("Messages not found")

    async def update_conversation(self, conversation: Conversation, session: Optional[DBSession] = None) -> Conversation:
        """Update an existing conversation"""
        conversation_path = os.path.join(self.data_dir, "conversations", f"{conversation.id}.json")
        if not os.path.exists(conversation_path):
            raise ValueError(f"Conversation {conversation.id} not found")
            
        # Save conversation data
        with open(conversation_path, "w") as f:
            json.dump(conversation.to_dict(), f)
        return conversation
