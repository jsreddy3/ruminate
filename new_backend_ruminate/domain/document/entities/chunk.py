from typing import Optional
from uuid import uuid4
from enum import Enum
from datetime import datetime
from dataclasses import dataclass, field


class ChunkStatus(str, Enum):
    UNPROCESSED = "UNPROCESSED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    ERROR = "ERROR"


@dataclass
class Chunk:
    """Domain entity for document chunks (20-page windows)"""
    id: str = field(default_factory=lambda: str(uuid4()))
    document_id: str = ""
    chunk_index: int = 0  # 0-based position in document
    start_page: int = 0   # inclusive
    end_page: int = 20    # exclusive (so pages 0-19 for first chunk)
    status: ChunkStatus = ChunkStatus.UNPROCESSED
    summary: Optional[str] = None
    processing_error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def set_processing(self) -> None:
        """Mark chunk as processing"""
        self.status = ChunkStatus.PROCESSING
        self.updated_at = datetime.now()
    
    def set_ready(self, summary: str) -> None:
        """Mark chunk as ready with summary"""
        self.status = ChunkStatus.READY
        self.summary = summary
        self.updated_at = datetime.now()
    
    def set_error(self, error: str) -> None:
        """Mark chunk as errored"""
        self.status = ChunkStatus.ERROR
        self.processing_error = error
        self.updated_at = datetime.now()
    
    def contains_page(self, page_number: int) -> bool:
        """Check if a page number falls within this chunk"""
        return self.start_page <= page_number < self.end_page
    
    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "chunk_index": self.chunk_index,
            "start_page": self.start_page,
            "end_page": self.end_page,
            "status": self.status.value if isinstance(self.status, Enum) else self.status,
            "summary": self.summary,
            "processing_error": self.processing_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Chunk':
        """Create Chunk from dictionary"""
        if data.get('status'):
            data['status'] = ChunkStatus(data['status'])
        if data.get('created_at') and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('updated_at') and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        return cls(**data)