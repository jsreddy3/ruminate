from typing import Optional
from pydantic import Field
from datetime import datetime
from uuid import uuid4
from src.models.base.base_model import BaseModel

class KeyTermNote(BaseModel):
    """
    Represents a note about a key term or theme found in a document chunk.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: str
    chunk_id: str
    chunk_sequence: int
    term: str  # The key term or theme
    label: str  # A short label for this note
    quote: str  # The quoted text
    explanation: str  # Explanation of why this is relevant to the term
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        orm_mode = True
