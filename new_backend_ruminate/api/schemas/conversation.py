# new_backend_ruminate/api/schemas/conversation.py

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from uuid import uuid4
from pydantic import BaseModel, Field


class ConversationType(str, Enum):
    DOCUMENT = "document"
    RABBITHOLE = "rabbithole"
    AGENT_RABBITHOLE = "agent_rabbithole"


class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    meta_data: Optional[Dict[str, Any]] = None
    is_demo: bool = False
    root_message_id: Optional[str] = None
    included_pages: Dict[str, str] = Field(default_factory=dict)
    active_thread_ids: List[str] = Field(default_factory=list)
    type: ConversationType = ConversationType.DOCUMENT
    source_block_id: Optional[str] = None
    selected_text: Optional[str] = None
    text_start_offset: Optional[int] = None
    text_end_offset: Optional[int] = None

    class Config:
        orm_mode = True
