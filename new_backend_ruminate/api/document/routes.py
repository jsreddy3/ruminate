"""Document API routes"""
from typing import Optional, List
from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import io

from new_backend_ruminate.api.document.schemas import (
    DocumentResponse, 
    DocumentUploadResponse, 
    DocumentListResponse,
    PageResponse,
    BlockResponse
)
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.dependencies import get_session, get_document_service, get_current_user
from new_backend_ruminate.domain.user.entities.user import User

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Upload a PDF document for processing
    
    The document will be:
    1. Stored in object storage
    2. Processed by Marker API for text extraction
    
    Returns immediately with document ID while processing continues in background.
    """
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        # Upload document
        document = await svc.upload_document(
            background=background_tasks,
            file=file.file,
            filename=file.filename,
            user_id=current_user.id
        )
        
        return DocumentUploadResponse(
            document=DocumentResponse(
                id=document.id,
                user_id=document.user_id,
                status=document.status,
                title=document.title,
                summary=document.summary,
                created_at=document.created_at,
                updated_at=document.updated_at,
                processing_error=document.processing_error
            )
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """Get document by ID"""
    document = await svc.get_document(document_id, current_user.id, session)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentResponse(
        id=document.id,
        user_id=document.user_id,
        status=document.status,
        title=document.title,
        summary=document.summary,
        created_at=document.created_at,
        updated_at=document.updated_at,
        processing_error=document.processing_error
    )


@router.get("/{document_id}/processing-stream")
async def get_processing_stream(
    document_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Get SSE stream for document processing status updates
    
    Events:
    - processing_started: Document processing has begun
    - processing_completed: Document is ready
    - processing_error: An error occurred
    """
    # Verify document exists and user has access
    document = await svc.get_document(document_id, current_user.id, session)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return await svc.get_processing_stream(document_id)


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """List user's documents"""
    documents = await svc.list_documents(current_user.id, session)
    
    return DocumentListResponse(
        documents=[
            DocumentResponse(
                id=doc.id,
                user_id=doc.user_id,
                status=doc.status,
                title=doc.title,
                summary=doc.summary,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
                processing_error=doc.processing_error
            )
            for doc in documents
        ],
        total=len(documents)
    )


@router.get("/{document_id}/pages", response_model=List[PageResponse])
async def get_document_pages(
    document_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """Get all pages for a document"""
    # Verify document exists and user has access
    document = await svc.get_document(document_id, current_user.id, session)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    pages = await svc.get_document_pages(document_id, current_user.id, session)
    
    return [
        PageResponse(
            id=page.id,
            document_id=page.document_id,
            page_number=page.page_number,
            html_content=page.html_content,
            polygon=page.polygon,
            block_count=len(page.block_ids) if page.block_ids else 0
        )
        for page in sorted(pages, key=lambda p: p.page_number)
    ]


@router.get("/{document_id}/blocks", response_model=List[BlockResponse])
async def get_document_blocks(
    document_id: str,
    page_number: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """Get all blocks for a document, optionally filtered by page"""
    # Verify document exists and user has access
    document = await svc.get_document(document_id, current_user.id, session)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    blocks = await svc.get_document_blocks(document_id, page_number, current_user.id, session)
    
    return [
        BlockResponse(
            id=block.id,
            document_id=block.document_id,
            page_id=block.page_id,
            page_number=block.page_number,
            block_type=block.block_type.value if block.block_type else None,
            html_content=block.html_content,
            polygon=block.polygon
        )
        for block in blocks
    ]


@router.get("/{document_id}/pdf")
async def download_document_pdf(
    document_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """Download the original PDF for a document"""
    try:
        file_content, filename = await svc.get_document_pdf(document_id, current_user.id, session)
        
        # Create streaming response
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading PDF: {str(e)}")