from typing import Optional
from pydantic import BaseModel, Field
from uuid import uuid4


class SendMessageRequest(BaseModel):
    content: str
    parent_id: Optional[str] = None


class MessageIdsResponse(BaseModel):
    """What the POST returns: user-msg id and ai-placeholder id."""
    user_id: str = Field(alias="user_msg_id")
    ai_id:   str = Field(alias="ai_msg_id")
