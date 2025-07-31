from typing import List, Optional, Dict, Any
from uuid import uuid4
from enum import Enum
from datetime import datetime
from dataclasses import dataclass, field


class DocumentStatus(str, Enum):
    PENDING = "PENDING"
    AWAITING_PROCESSING = "AWAITING_PROCESSING"  # Waiting for user to trigger processing
    PROCESSING_MARKER = "PROCESSING_MARKER"
    PROCESSING_RUMINATION = "PROCESSING_RUMINATION"
    READY = "READY"
    ERROR = "ERROR"


@dataclass
class Document:
    """Domain entity for Document"""
    id: str = field(default_factory=lambda: str(uuid4()))
    user_id: Optional[str] = None
    status: DocumentStatus = DocumentStatus.PENDING
    s3_pdf_path: Optional[str] = None
    title: str = "Untitled Document"
    summary: Optional[str] = None
    arguments: Optional[List[Dict[str, str]]] = None  # List of {id, name}
    key_themes_terms: Optional[List[Dict[str, str]]] = None
    processing_error: Optional[str] = None
    marker_job_id: Optional[str] = None
    marker_check_url: Optional[str] = None
    # Batch processing fields
    parent_document_id: Optional[str] = None    # Links to parent document for chunks
    batch_id: Optional[str] = None              # Groups chunks from same upload
    chunk_index: Optional[int] = None           # Position in batch (0-based)
    total_chunks: Optional[int] = None          # Total chunks in batch
    is_auto_processed: bool = False             # True for first chunk only
    # Reading progress fields
    furthest_read_block_id: Optional[str] = None
    furthest_read_position: Optional[int] = None
    furthest_read_updated_at: Optional[datetime] = None
    # Main conversation field
    main_conversation_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def start_marker_processing(self) -> None:
        """Start Marker processing"""
        self.status = DocumentStatus.PROCESSING_MARKER
        self.updated_at = datetime.now()
        
    def set_awaiting_processing(self) -> None:
        """Set status to awaiting user trigger"""
        self.status = DocumentStatus.AWAITING_PROCESSING
        self.updated_at = datetime.now()
        
    def set_error(self, error: str) -> None:
        """Set error status and message"""
        self.status = DocumentStatus.ERROR
        self.processing_error = error
        self.updated_at = datetime.now()
        
    def set_ready(self) -> None:
        """Set status to ready"""
        self.status = DocumentStatus.READY
        self.updated_at = datetime.now()
    
    def update_reading_progress(self, block_id: str, position: int) -> None:
        """Update reading progress to furthest block"""
        self.furthest_read_block_id = block_id
        self.furthest_read_position = position
        self.furthest_read_updated_at = datetime.now()
        self.updated_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "status": self.status.value if isinstance(self.status, Enum) else self.status,
            "s3_pdf_path": self.s3_pdf_path,
            "title": self.title,
            "summary": self.summary,
            "arguments": self.arguments,
            "key_themes_terms": self.key_themes_terms,
            "processing_error": self.processing_error,
            "marker_job_id": self.marker_job_id,
            "marker_check_url": self.marker_check_url,
            "parent_document_id": self.parent_document_id,
            "batch_id": self.batch_id,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "is_auto_processed": self.is_auto_processed,
            "furthest_read_block_id": self.furthest_read_block_id,
            "furthest_read_position": self.furthest_read_position,
            "furthest_read_updated_at": self.furthest_read_updated_at.isoformat() if self.furthest_read_updated_at else None,
            "main_conversation_id": self.main_conversation_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Document':
        """Create Document from dictionary"""
        if data.get('status'):
            data['status'] = DocumentStatus(data['status'])
        if data.get('created_at') and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('updated_at') and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        if data.get('furthest_read_updated_at') and isinstance(data['furthest_read_updated_at'], str):
            data['furthest_read_updated_at'] = datetime.fromisoformat(data['furthest_read_updated_at'])
        return cls(**data)