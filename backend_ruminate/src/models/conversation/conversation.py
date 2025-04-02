from typing import Dict, Any, Optional
from datetime import datetime
from uuid import uuid4
from pydantic import Field
from src.models.base.base_model import BaseModel
from sqlalchemy import Column, String, JSON, Boolean
from src.database.base import Base

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

class ConversationModel(Base):
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=True, index=True)
    block_id = Column(String, nullable=True, index=True)
    type = Column(String, default=ConversationType.MAIN)
    created_at = Column(String)  # Store as ISO format string
    meta_data = Column(JSON, nullable=True)
    is_demo = Column(Boolean, default=False)
    root_message_id = Column(String, nullable=True)