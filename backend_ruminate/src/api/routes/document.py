from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from src.services.document.upload_service import UploadService
from src.api.dependencies import get_upload_service, get_document_repository, get_storage_repository, get_db
from src.repositories.interfaces.document_repository import DocumentRepository
from src.repositories.interfaces.storage_repository import StorageRepository
from src.models.viewer.block import Block
from src.models.base.document import Document
from src.models.base.chunk import Chunk
from src.api.sse_manager import subscribe_to_updates
import logging
import io
import os

logger = logging.getLogger(__name__)

document_router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    responses={404: {"description": "Not found"}},
)

@document_router.get("/{document_id}/processing-stream")
async def stream_processing_status(document_id: str):
    """Streams document processing status updates via Server-Sent Events."""
    logger.info(f"Request received for SSE stream for document_id: {document_id}")
    return StreamingResponse(subscribe_to_updates(document_id), media_type="text/event-stream")

@document_router.post("/")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    upload_service: UploadService = Depends(get_upload_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Document:
    """Upload a new document"""
    # For testing purposes, using a fixed user_id
    doc = await upload_service.upload(file, background_tasks, session, user_id="test_user")
    return doc

@document_router.get("/{document_id}")
async def get_document(
    document_id: str,
    document_repository: DocumentRepository = Depends(get_document_repository),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Document:
    """Get a document by ID"""
    doc = await document_repository.get_document(document_id, session=session)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@document_router.get("/{document_id}/pages")
async def get_pages(
    document_id: str,
    document_repository: DocumentRepository = Depends(get_document_repository),
    session: Optional[AsyncSession] = Depends(get_db)
):
    """Get all pages for a document"""
    pages = await document_repository.get_document_pages(document_id, session=session)
    if not pages:
        raise HTTPException(status_code=404, detail="Pages not found")
    return pages

@document_router.get("/{document_id}/blocks")
async def get_blocks(
    document_id: str,
    document_repository: DocumentRepository = Depends(get_document_repository),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Block]:
    """Get all blocks for a document"""
    blocks = await document_repository.get_blocks(document_id, session)
    if not blocks:
        raise HTTPException(status_code=404, detail="Blocks not found")
    return blocks

@document_router.get("/{document_id}/arguments")
async def get_document_arguments(
    document_id: str,
    document_repository: DocumentRepository = Depends(get_document_repository),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[dict]:
    """Get all arguments for a document"""
    document = await document_repository.get_document(document_id, session)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if not document.arguments:
        raise HTTPException(status_code=404, detail="No arguments found for document")
        
    return document.arguments

@document_router.get("/{document_id}/pdf")
async def get_pdf(
    document_id: str,
    document_repository: DocumentRepository = Depends(get_document_repository),
    storage_repository: StorageRepository = Depends(get_storage_repository),
    session: Optional[AsyncSession] = Depends(get_db)
):
    """Get the PDF file for a document"""
    # Get document to verify it exists and get s3_pdf_path if available
    doc = await document_repository.get_document(document_id, session=session)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Retrieve PDF from storage
    try:
        # Use s3_pdf_path if available, otherwise construct a path based on document_id
        file_path = doc.s3_pdf_path if doc.s3_pdf_path else f"{document_id}.pdf"
        
        # Check if it's a local storage repository
        if hasattr(storage_repository, 'storage_dir'):
            # For local storage, construct the full path
            file_path = os.path.join(storage_repository.storage_dir, f"{document_id}.pdf")
        
        pdf_data = await storage_repository.get_file(file_path, session)
        if not pdf_data:
            raise HTTPException(status_code=404, detail="PDF file not found")
        
        # Return as StreamingResponse
        return StreamingResponse(
            io.BytesIO(pdf_data),
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={doc.title or 'document.pdf'}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving PDF: {str(e)}")