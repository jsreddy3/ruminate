# new_backend_ruminate/api/conversation/schema.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator


# ─────────────────────────────── Enums ──────────────────────────────── #

class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ConversationType(str, Enum):
    CHAT = "CHAT"
    AGENT = "AGENT"
    RABBITHOLE = "RABBITHOLE"


# ─────────────────────── Transport-layer DTOs ───────────────────────── #

# --- requests --------------------------------------------------------- #
class CreateConversationRequest(BaseModel):
    """
    Request body for POST /conversations
    Supports both regular conversations and rabbithole conversations
    """
    type: ConversationType = ConversationType.CHAT
    meta: Optional[dict] = None
    
    # Rabbithole-specific fields (optional)
    document_id: Optional[str] = None
    source_block_id: Optional[str] = None
    selected_text: Optional[str] = None
    text_start_offset: Optional[int] = None
    text_end_offset: Optional[int] = None
    
    @validator('text_end_offset')
    def validate_offsets(cls, v, values):
        """Ensure end offset is greater than start offset if both are provided"""
        start = values.get('text_start_offset')
        if start is not None and v is not None and v <= start:
            raise ValueError('text_end_offset must be greater than text_start_offset')
        return v
    
    @validator('selected_text')
    def validate_rabbithole_fields(cls, v, values):
        """Ensure all rabbithole fields are provided together for RABBITHOLE type"""
        if values.get('type') == ConversationType.RABBITHOLE:
            if not v:
                raise ValueError('selected_text is required for RABBITHOLE conversations')
            if not values.get('document_id'):
                raise ValueError('document_id is required for RABBITHOLE conversations')
            if not values.get('source_block_id'):
                raise ValueError('source_block_id is required for RABBITHOLE conversations')
        return v


class SendMessageRequest(BaseModel):
    """
    Body for both
        • POST /conversations/{cid}/messages
        • PUT  /conversations/{cid}/messages/{mid}/edit_streaming
    """
    content: str
    parent_id: Optional[UUID] = None


# --- responses -------------------------------------------------------- #
class MessageIdsResponse(BaseModel):
    """
    What the create / edit endpoints return: the freshly‐created user
    message id and the assistant placeholder id that will stream chunks.
    """
    user_msg_id: UUID = Field(..., alias="user_id")
    ai_msg_id:   UUID = Field(..., alias="ai_id")

    class Config:
        allow_population_by_field_name = True


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    parent_id: Optional[UUID] = None
    active_child_id: Optional[UUID] = None
    version: int
    role: Role
    content: str
    created_at: datetime


class ConversationOut(BaseModel):
    id: UUID
    created_at: datetime
    type: ConversationType = ConversationType.CHAT
    root_message_id: Optional[UUID] = None
    active_thread_ids: List[UUID] = Field(default_factory=list)
    is_demo: bool = False
    meta_data: Optional[dict] = None
    
    # Document/rabbithole fields (optional)
    document_id: Optional[str] = None
    source_block_id: Optional[str] = None
    selected_text: Optional[str] = None
    text_start_offset: Optional[int] = None
    text_end_offset: Optional[int] = None

class ConversationInitResponse(BaseModel):
    conversation_id: str = Field(..., alias="conversation_id")
    system_msg_id:   str = Field(..., alias="system_msg_id")