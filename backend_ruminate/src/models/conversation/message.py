from datetime import datetime
from uuid import uuid4
from typing import Optional, Dict, Any, List
from src.models.base.base_model import BaseModel
from enum import Enum
from pydantic import Field

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    conversation_id: str
    role: MessageRole
    content: str
    created_at: datetime = datetime.utcnow()
    parent_id: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    block_id: Optional[str] = None
    active_child_id: Optional[str] = None
    children: Optional[List['Message']] = None
    active_child: Optional['Message'] = None
    version: int = 1

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Message':
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if 'role' in data and isinstance(data['role'], str):
            data['role'] = MessageRole(data['role'])  # Convert string to enum
        return cls(**data)