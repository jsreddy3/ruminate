"""Pydantic schemas for document API"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from new_backend_ruminate.domain.document.entities import DocumentStatus


class DocumentResponse(BaseModel):
    """Response schema for document"""
    id: str
    user_id: Optional[str]
    status: DocumentStatus
    title: str
    summary: Optional[str]
    created_at: datetime
    updated_at: datetime
    processing_error: Optional[str]
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class DocumentListResponse(BaseModel):
    """Response schema for list of documents"""
    documents: List[DocumentResponse]
    total: int


class DocumentUploadResponse(BaseModel):
    """Response schema for document upload"""
    document: DocumentResponse
    message: str = "Document uploaded successfully and processing started"


class PageResponse(BaseModel):
    """Response schema for document page"""
    id: str
    document_id: str
    page_number: int
    html_content: str
    polygon: Optional[List[List[float]]]
    block_count: int = 0
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class BlockResponse(BaseModel):
    """Response schema for document block"""
    id: str
    document_id: str
    page_id: Optional[str]
    page_number: Optional[int]
    block_type: Optional[str]
    html_content: Optional[str]
    polygon: Optional[List[List[float]]]
    section_hierarchy: Optional[Dict[str, str]] = None
    metadata: Optional[Dict[str, Any]] = None
    images: Optional[Dict[str, str]] = None
    is_critical: Optional[bool] = None
    critical_summary: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class DefinitionRequest(BaseModel):
    """Request schema for getting a definition"""
    term: str = Field(..., description="The term to define")
    block_id: str = Field(..., description="The block ID containing the term")
    text_start_offset: int = Field(..., description="Start position of the term in the block text")
    text_end_offset: int = Field(..., description="End position of the term in the block text")
    surrounding_text: Optional[str] = Field(None, description="Optional surrounding text for better context")


class DefinitionResponse(BaseModel):
    """Response schema for definition"""
    term: str
    definition: str
    context: Optional[str] = Field(None, description="The context used to generate the definition")
    block_id: str


class AnnotationRequest(BaseModel):
    """Request schema for creating/updating an annotation"""
    text: str = Field(..., description="The selected text being annotated")
    note: str = Field(..., description="The annotation content")
    text_start_offset: int = Field(..., description="Start position of the annotated text in the block")
    text_end_offset: int = Field(..., description="End position of the annotated text in the block")


