from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum
from uuid import uuid4
from pydantic import Field
from src.models.base.base_model import BaseModel
from sqlalchemy import Column, String, JSON, Boolean
from src.database.base import Base
from enum import Enum

class ConversationType(str, Enum):
    DOCUMENT = "document"
    RABBITHOLE = "rabbithole"
    AGENT_RABBITHOLE = "agent_rabbithole"

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: Optional[str] = None
    created_at: datetime = datetime.utcnow()
    meta_data: Optional[Dict[str, Any]] = None
    is_demo: bool = False
    root_message_id: Optional[str] = None
    included_pages: Dict[str, str] = Field(default_factory=dict)  # Maps page_number -> message_id
    active_thread_ids: List[str] = Field(default_factory=list)  # Ordered list of message IDs in the active thread

    # New fields for rabbithole support
    type: ConversationType = ConversationType.DOCUMENT
    source_block_id: Optional[str] = None  # Block ID that contains the highlighted text
    selected_text: Optional[str] = None    # The highlighted text
    text_start_offset: Optional[int] = None  # Start position of highlighted text
    text_end_offset: Optional[int] = None    # End position of highlighted text

    class Config:
        from_attributes = True  # For SQLAlchemy compatibility

    def __init__(self, **data):
        super().__init__(**data)
        if 'document_id' not in data or not data['document_id']:
            raise ValueError("document_id is required for Conversation")

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
    created_at = Column(String)  # Store as ISO format string
    meta_data = Column(JSON, nullable=True)
    is_demo = Column(Boolean, default=False)
    root_message_id = Column(String, nullable=True)
    included_pages = Column(JSON, nullable=True)  # Store as JSON serialized dict
    active_thread_ids = Column(JSON, nullable=True)  # Store as JSON serialized list of message IDs

    # New columns for rabbithole support
    type = Column(String, default=ConversationType.DOCUMENT.value)
    source_block_id = Column(String, nullable=True, index=True)
    selected_text = Column(String, nullable=True)
    text_start_offset = Column(JSON, nullable=True)  # Using JSON to allow complex offset structure if needed
    text_end_offset = Column(JSON, nullable=True)    # Using JSON to allow complex offset structure if needed