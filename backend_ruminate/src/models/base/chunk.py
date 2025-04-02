# models/viewer/chunk.py
from typing import List, Optional, Dict, Any
from uuid import uuid4
from pydantic import Field
from datetime import datetime
from src.models.base.base_model import BaseModel
from sqlalchemy import Column, String, Text, JSON, Integer, ForeignKey
from src.database.base import Base

class Chunk(BaseModel):
    """
    Represents a semantic chunk of document content.
    A chunk consists of multiple blocks that form a coherent semantic unit.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: str
    title: Optional[str] = None
    sequence: int  # Order in the document
    page_range: List[int]  # [start_page, end_page]
    block_ids: List[str]  # IDs of blocks contained in this chunk
    html_content: str  # Combined HTML content
    embedding: Optional[List[float]] = None  # Vector embedding for semantic search
    summary: Optional[str] = None  # Optional chunk summary
    metadata: Optional[Dict] = None  # Additional metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    # This will be populated by the ORM when querying
    index: Optional[Any] = None  # Back reference to ChunkIndex

    class Config:
        orm_mode = True
        
    def get(self, key, default=None):
        """Provide dictionary-like access to attributes"""
        return getattr(self, key, default)
        
    def dict(self, *args, **kwargs):
        """Override the default dict method to ensure consistent access"""
        # Get the standard dictionary
        result = super().dict(*args, **kwargs)
        return result

    @classmethod
    def from_dict(cls, data: Dict) -> 'Chunk':
        """Create Chunk from dictionary"""
        if 'document_id' not in data:
            raise ValueError("document_id is required")
            
        return cls(
            id=data.get('id'),
            document_id=data['document_id'],
            title=data.get('title'),
            sequence=data.get('sequence', 0),
            page_range=data.get('page_range', [1, 1]),
            block_ids=data.get('block_ids', []),
            html_content=data.get('html_content', ''),
            embedding=data.get('embedding'),
            summary=data.get('summary'),
            metadata=data.get('metadata'),
            created_at=data.get('created_at', datetime.now()),
            updated_at=data.get('updated_at', datetime.now())
        )

# SQLAlchemy model definition
class ChunkModel(Base):
    __tablename__ = "chunks"
    
    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"))
    title = Column(String, nullable=True)
    sequence = Column(Integer)
    page_range = Column(JSON)
    block_ids = Column(JSON)
    html_content = Column(Text)
    content = Column(Text, nullable=True)
    embedding = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)
    index = Column(String, nullable=True)  # Added for back reference to ChunkIndex