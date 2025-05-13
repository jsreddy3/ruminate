# new_backend_ruminate/api/schemas/message.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID

class Message(BaseModel):
    id: UUID
    conversation_id: UUID
    parent_id: Optional[UUID] = None
    active_child_id: Optional[UUID] = None
    version: int
    role: str
    content: str
    created_at: datetime

    class Config:
        orm_mode = True          # Pydantic v1; switch to `model_config` in v2


class SendMessageRequest(BaseModel):
    content: str
    parent_id: Optional[str] = None


class MessageIdsResponse(BaseModel):
    """What the POST returns: user-msg id and ai-placeholder id."""
    user_id: str = Field(alias="user_msg_id")
    ai_id:   str = Field(alias="ai_msg_id")
