# models/base/document.py
from typing import List, Optional, Dict, Any
from uuid import uuid4
from enum import Enum
from pydantic import Field
from src.models.base.base_model import BaseModel
from datetime import datetime

class DocumentStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING_MARKER = "PROCESSING_MARKER"
    PROCESSING_RUMINATION = "PROCESSING_RUMINATION"
    READY = "READY"
    ERROR = "ERROR"

class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: Optional[str] = None
    status: DocumentStatus = DocumentStatus.PENDING
    s3_pdf_path: Optional[str] = None
    chunk_ids: List[str] = Field(default_factory=list)
    title: str = "Untitled Document"
    summary: Optional[str] = None  # Store document summary
    arguments: Optional[List[Dict[str, str]]] = None  # Store document arguments - list of {id, name}
    key_themes_terms: Optional[List[Dict[str, str]]] = None  # Store document key themes and terms
    processing_error: Optional[str] = None
    marker_job_id: Optional[str] = None  # to track Marker processing
    marker_check_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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
        
    def start_marker_processing(self) -> None:
        """Start Marker processing"""
        self.status = DocumentStatus.PROCESSING_MARKER
        
    def start_rumination_processing(self) -> None:
        """Start Rumination processing"""
        self.status = DocumentStatus.PROCESSING_RUMINATION
        
    def set_error(self, error: str) -> None:
        """Set error status and message"""
        self.status = DocumentStatus.ERROR
        self.processing_error = error
        
    def set_ready(self) -> None:
        """Set status to ready"""
        self.status = DocumentStatus.READY

    class Config:
        use_enum_values = True