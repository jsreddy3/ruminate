from typing import Dict, Any, Optional, List
from datetime import datetime
from uuid import uuid4
from pydantic import Field
from src.models.base.base_model import BaseModel
from sqlalchemy import Column, String, JSON, Boolean, Integer, Text
from src.database.base import Base

class Notes(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: str
    block_id: str
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    content: str = ""
    block_sequence_no: Optional[int] = None
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()
    meta_data: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True  # For SQLAlchemy compatibility

    def __init__(self, **data):
        super().__init__(**data)
        if 'document_id' not in data or not data['document_id']:
            raise ValueError("document_id is required for Notes")
        if 'block_id' not in data or not data['block_id']:
            raise ValueError("block_id is required for Notes")

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        # Convert datetime to ISO format string
        if self.created_at:
            d['created_at'] = self.created_at.isoformat()
        if self.updated_at:
            d['updated_at'] = self.updated_at.isoformat()
        return d
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Notes':
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if 'updated_at' in data and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        return cls(**data)

    def update_content(self, new_content: str) -> None:
        """Update the content of the note"""
        self.content = new_content
        self.updated_at = datetime.utcnow()

class NotesModel(Base):
    __tablename__ = "notes"
    
    id = Column(String, primary_key=True)
    document_id = Column(String, nullable=False, index=True)
    block_id = Column(String, nullable=False, index=True)
    conversation_id = Column(String, nullable=True, index=True)
    message_id = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    block_sequence_no = Column(Integer, nullable=True)
    created_at = Column(String, nullable=False)  # Store as ISO format string
    updated_at = Column(String, nullable=False)  # Store as ISO format string
    meta_data = Column(JSON, nullable=True)
