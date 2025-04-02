from typing import Dict, Any, Optional
from datetime import datetime
from uuid import uuid4
from pydantic import Field
from src.models.base.base_model import BaseModel

class ConversationType(str):
    MAIN = "main"
    BLOCK = "block"

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: Optional[str] = None
    block_id: Optional[str] = None
    type: str = ConversationType.MAIN
    created_at: datetime = datetime.utcnow()
    meta_data: Optional[Dict[str, Any]] = None
    is_demo: bool = False
    root_message_id: Optional[str] = None

    class Config:
        from_attributes = True  # For SQLAlchemy compatibility

    def __init__(self, **data):
        super().__init__(**data)

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        # Convert datetime to ISO format string
        if self.created_at:
            d['created_at'] = self.created_at.isoformat()
        return d
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Conversation':
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)