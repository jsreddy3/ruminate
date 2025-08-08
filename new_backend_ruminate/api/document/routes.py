"""Document API routes"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import io
import uuid

from new_backend_ruminate.api.document.schemas import (
    DocumentResponse, 
    DocumentUploadResponse, 
    DocumentListResponse,
    PageResponse,
    BlockResponse,
    DefinitionRequest,
    DefinitionResponse,
    EnhancedDefinitionResponse,
    AnnotationRequest,
    AnnotationResponse,
    S3UploadRequest,
    DocumentUpdateRequest,
    ReadingProgressRequest
)
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.dependencies import get_session, get_document_service, get_current_user, get_current_user_from_query_token, get_storage_service
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.utils.file_validator import PDFValidator, SecurityScanner

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/upload-url")
async def get_upload_url(
    filename: str,
    current_user: User = Depends(get_current_user),
    storage = Depends(get_storage_service)
):
    """
    Get a presigned URL for direct S3 upload.
    
    Returns:
        - upload_url: The S3 URL to PUT the file to
        - key: The S3 key where the file will be stored
    """
    from uuid import uuid4
    
    # Validate file type and size constraints for presigned URL
    if not filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Add file size constraints to presigned URL generation
    max_file_size = PDFValidator.MAX_FILE_SIZE  # 100MB
    
    # Generate S3 key
    document_id = str(uuid4())
    storage_key = f"documents/{document_id}/{filename}"
    
    try:
        # Generate presigned POST URL and fields with size restrictions
        presigned_data = await storage.generate_presigned_post(
            key=storage_key,
            content_type="application/pdf",
            expires_in=3600,  # 1 hour
            max_file_size=max_file_size
        )
        
        return {
            "upload_url": presigned_data["url"],
            "fields": presigned_data["fields"],
            "key": storage_key
        }
        
    except Exception as e:
        print(f"[Upload URL Route] Error generating presigned URL: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating upload URL: {str(e)}")


@router.post("/", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    svc: DocumentService = Depends(get_document_service),
    storage = Depends(get_storage_service)
):
    """
    Upload a PDF document for processing
    
    Accepts either:
    1. A PDF file upload (multipart/form-data)
    2. A JSON body with s3_key and filename (for files already uploaded to S3)
    
    Both paths use the same processing logic.
    Returns immediately with document ID while processing continues in background.
    """
    
    # Check if this is a file upload or S3 URL upload
    content_type = request.headers.get("content-type", "")
    
    if file and file.filename:
        # Traditional file upload path with comprehensive validation
        
        # Step 1: Comprehensive PDF validation
        PDFValidator.validate_and_raise(file)
        
        # Step 2: Security scanning and read file content once
        file_content = await file.read()
        
        is_safe, security_warning = SecurityScanner.is_pdf_safe(file_content)
        if not is_safe:
            raise HTTPException(
                status_code=422, 
                detail=f"PDF contains potentially dangerous content: {security_warning}"
            )
        
        filename = file.filename
        s3_key = None  # No pre-existing S3 key for direct uploads
        
    elif "application/json" in content_type:
        # S3 URL upload path - pass S3 key directly without downloading
        try:
            body = await request.json()
            s3_request = S3UploadRequest(**body)
            
            print(f"[Upload Route] Processing S3 upload with key: {s3_request.s3_key}")
            
            # For S3 uploads, we'll pass the key directly to avoid re-downloading
            filename = s3_request.filename
            s3_key = s3_request.s3_key
            file_content = None  # Will be downloaded by service if needed
            
        except Exception as e:
            print(f"[Upload Route] Error processing S3 request: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to process S3 upload: {str(e)}")
    
    else:
        raise HTTPException(
            status_code=400, 
            detail="Must provide either a file upload or JSON body with s3_key"
        )
    
    # Now use the SAME upload logic regardless of source
    try:
        print(f"[Upload Route] Starting upload for file: {filename}")
        
        document = await svc.upload_document(
            background=background_tasks,
            file_content=file_content,
            filename=filename,
            user_id=current_user.id,
            s3_key=s3_key  # Pass S3 key if available
        )
        
        print(f"[Upload Route] Upload successful, document ID: {document.id}")
        
        return DocumentUploadResponse(
            document=DocumentResponse(
                id=document.id,
                user_id=document.user_id,
                status=document.status,
                title=document.title,
                summary=document.summary,
                created_at=document.created_at,
                updated_at=document.updated_at,
                processing_error=document.processing_error,
                parent_document_id=document.parent_document_id,
                batch_id=document.batch_id,
                chunk_index=document.chunk_index,
                total_chunks=document.total_chunks,
                is_auto_processed=document.is_auto_processed,
                main_conversation_id=document.main_conversation_id,
                document_info=document.document_info
            )
        )
        
    except ValueError as e:
        print(f"[Upload Route] ValueError: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[Upload Route] Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[Upload Route] Traceback: {traceback.format_exc()}")
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
    
    print(f"[GET Document] Returning reading progress for {document_id}: block_id={document.furthest_read_block_id}, position={document.furthest_read_position}, updated_at={document.furthest_read_updated_at}")
    print(f"[GET Document] main_conversation_id: {document.main_conversation_id}")
    
    return DocumentResponse(
        id=document.id,
        user_id=document.user_id,
        status=document.status,
        title=document.title,
        summary=document.summary,
        created_at=document.created_at,
        updated_at=document.updated_at,
        processing_error=document.processing_error,
        parent_document_id=document.parent_document_id,
        batch_id=document.batch_id,
        chunk_index=document.chunk_index,
        total_chunks=document.total_chunks,
        is_auto_processed=document.is_auto_processed,
        furthest_read_block_id=document.furthest_read_block_id,
        furthest_read_position=document.furthest_read_position,
        furthest_read_updated_at=document.furthest_read_updated_at,
        main_conversation_id=document.main_conversation_id,
        document_info=document.document_info
    )


@router.get("/{document_id}/processing-stream")
async def get_processing_stream(
    document_id: str,
    current_user: User = Depends(get_current_user_from_query_token),
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
                processing_error=doc.processing_error,
                parent_document_id=doc.parent_document_id,
                batch_id=doc.batch_id,
                chunk_index=doc.chunk_index,
                total_chunks=doc.total_chunks,
                is_auto_processed=doc.is_auto_processed,
                furthest_read_block_id=doc.furthest_read_block_id,
                furthest_read_position=doc.furthest_read_position,
                furthest_read_updated_at=doc.furthest_read_updated_at,
                main_conversation_id=doc.main_conversation_id,
                document_info=doc.document_info
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
    include_images: bool = True,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Get all blocks for a document, optionally filtered by page.
    
    Query parameters:
    - page_number: Filter blocks by specific page number
    - include_images: Whether to include base64 image data (default: true)
                     Set to false for lazy loading images
    """
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
            polygon=block.polygon,
            section_hierarchy=block.section_hierarchy,
            metadata=block.metadata,
            images=block.images if include_images else (
                {key: "LAZY_LOAD" for key in (block.images or {}).keys()}
                if block.images else None
            ),
            is_critical=block.is_critical,
            critical_summary=block.critical_summary
        )
        for block in blocks
    ]


@router.get("/{document_id}/blocks/{block_id}/images")
async def get_block_images(
    document_id: str,
    block_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Get images for a specific block.
    
    This endpoint is used for lazy loading block images when include_images=false
    was used in the blocks endpoint.
    
    Returns:
        Dictionary of image keys to base64 encoded image data
    """
    # Verify document exists and user has access
    document = await svc.get_document(document_id, current_user.id, session)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get the specific block
    blocks = await svc.get_document_blocks(document_id, None, current_user.id, session)
    block = next((b for b in blocks if b.id == block_id), None)
    
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    
    return {"images": block.images or {}}


@router.get("/{document_id}/pdf-url")
async def get_document_pdf_url(
    document_id: str,
    expiration: int = 3600,  # 1 hour default
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """Get presigned URL for PDF access"""
    try:
        url = await svc.get_document_pdf_url(document_id, current_user.id, session, expiration)
        return {"pdf_url": url, "expires_in": expiration}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF URL: {str(e)}")


@router.get("/{document_id}/pdf")
async def download_document_pdf(
    document_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """Download the original PDF for a document (legacy endpoint - consider using /pdf-url instead)"""
    print(f"[PDF Route] Starting PDF download for document {document_id}, user {current_user.id}")
    
    try:
        file_content, filename = await svc.get_document_pdf(document_id, current_user.id, session)
        
        print(f"[PDF Route] Successfully retrieved PDF: {filename}, {len(file_content)} bytes")
        
        # Create streaming response
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except ValueError as e:
        print(f"[PDF Route] ValueError: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"[PDF Route] Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[PDF Route] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error downloading PDF: {str(e)}")


@router.post("/{document_id}/define", response_model=EnhancedDefinitionResponse)
async def get_definition(
    document_id: str,
    request: DefinitionRequest,
    current_user: User = Depends(get_current_user),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Get a contextual definition for a term within a document.
    
    This endpoint:
    1. Retrieves the specified block and surrounding context
    2. Uses the document's content to generate a contextual definition
    3. Saves the definition to block metadata
    4. Returns the complete definition data with positioning info
    """
    try:
        # Call the service method to get the definition
        definition_result = await svc.get_term_definition(
            document_id=document_id,
            block_id=request.block_id,
            term=request.term,
            text_start_offset=request.text_start_offset,
            text_end_offset=request.text_end_offset,
            surrounding_text=request.surrounding_text,
            user_id=current_user.id,
            debug_mode=False
        )
        
        return EnhancedDefinitionResponse(
            term=definition_result["term"],
            definition=definition_result.get("definition"),
            text_start_offset=definition_result["text_start_offset"],
            text_end_offset=definition_result["text_end_offset"],
            created_at=definition_result["created_at"],
            context=definition_result.get("context"),
            block_id=definition_result["block_id"]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating definition: {str(e)}")




@router.post("/{document_id}/blocks/{block_id}/annotate")
async def update_block_annotations(
    document_id: str,
    block_id: str,
    request: AnnotationRequest,
    current_user: User = Depends(get_current_user),
    svc: DocumentService = Depends(get_document_service),
    session: AsyncSession = Depends(get_session)
):
    """
    Create or update an annotation on a block.
    
    This endpoint handles all annotation operations:
    - Create: Provide text, note, and offsets -> Returns annotation data
    - Update: Provide same offsets with new note -> Returns updated annotation data
    - Delete: Provide offsets with empty note ("") -> Returns None
    
    Annotations are stored in block metadata and immediately returned for UI updates.
    """
    try:
        annotation_data = await svc.update_block_annotation(
            document_id=document_id,
            block_id=block_id,
            text=request.text,
            note=request.note,
            text_start_offset=request.text_start_offset,
            text_end_offset=request.text_end_offset,
            user_id=current_user.id,
            session=session
        )
        
        if annotation_data is None:
            # Annotation was deleted
            return {"message": "Annotation deleted successfully"}
        else:
            # Return the complete annotation data
            return AnnotationResponse(
                id=annotation_data["id"],
                text=annotation_data["text"],
                note=annotation_data["note"],
                text_start_offset=annotation_data["text_start_offset"],
                text_end_offset=annotation_data["text_end_offset"],
                created_at=annotation_data["created_at"],
                updated_at=annotation_data["updated_at"]
            )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating annotation: {str(e)}")


@router.patch("/{document_id}")
async def update_document(
    document_id: str,
    update_data: DocumentUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Update document metadata.
    
    Currently supports updating:
    - title: The display name of the document
    
    Returns the updated document.
    """
    try:
        # Prepare updates dictionary
        updates = {}
        if update_data.title is not None:
            updates["title"] = update_data.title
        
        # Use service method to update document
        updated_document = await svc.update_document(document_id, current_user.id, updates, session)
        
        # Return the updated document
        return DocumentResponse(
            id=updated_document.id,
            user_id=updated_document.user_id,
            status=updated_document.status,
            title=updated_document.title,
            summary=updated_document.summary,
            created_at=updated_document.created_at,
            updated_at=updated_document.updated_at,
            processing_error=updated_document.processing_error,
            parent_document_id=updated_document.parent_document_id,
            batch_id=updated_document.batch_id,
            chunk_index=updated_document.chunk_index,
            total_chunks=updated_document.total_chunks,
            is_auto_processed=updated_document.is_auto_processed,
            main_conversation_id=updated_document.main_conversation_id,
            document_info=updated_document.document_info,
        )
        
    except ValueError as e:
        print(f"[UPDATE_DOCUMENT] ValueError: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        print(f"[UPDATE_DOCUMENT] PermissionError: {str(e)}")
        raise HTTPException(status_code=403, detail="Access denied: You don't own this document")
    except Exception as e:
        print(f"[UPDATE_DOCUMENT] Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error updating document: {str(e)}")


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Delete a document and all its associated data.
    
    This endpoint will:
    1. Verify the user owns the document
    2. Delete the PDF file from object storage
    3. Delete the document record (which cascades to pages and blocks)
    4. Clean up any related conversations and messages
    
    Returns 204 No Content on success, 404 if document not found.
    """
    try:
        deleted = await svc.delete_document(document_id, current_user.id, session)
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"message": "Document deleted successfully"}
        
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied: You don't own this document")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[DELETE Route] Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[DELETE Route] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error deleting document: {str(e)}")


@router.post("/{document_id}/start-processing", response_model=DocumentResponse)
async def start_document_processing(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Start processing for a document chunk that's in AWAITING_PROCESSING status.
    
    This endpoint is used to trigger processing for document chunks created
    from large PDF uploads that are waiting for user approval to process.
    
    Returns the updated document with PENDING status.
    """
    try:
        document = await svc.start_chunk_processing(
            document_id=document_id,
            user_id=current_user.id,
            background=background_tasks,
            session=session
        )
        
        return DocumentResponse(
            id=document.id,
            user_id=document.user_id,
            status=document.status,
            title=document.title,
            summary=document.summary,
            created_at=document.created_at,
            updated_at=document.updated_at,
            processing_error=document.processing_error,
            parent_document_id=document.parent_document_id,
            batch_id=document.batch_id,
            chunk_index=document.chunk_index,
            total_chunks=document.total_chunks,
            is_auto_processed=document.is_auto_processed,
            main_conversation_id=document.main_conversation_id,
            document_info=document.document_info,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied: You don't own this document")
    except Exception as e:
        print(f"[START_PROCESSING Route] Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[START_PROCESSING Route] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error starting document processing: {str(e)}")


@router.patch("/{document_id}/reading-progress", response_model=DocumentResponse)
async def update_reading_progress(
    document_id: str,
    request: ReadingProgressRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Update reading progress for a document.
    
    This endpoint tracks how far the user has read in the document by storing
    the furthest block ID and its position in the reading order. Only updates
    if the new position is further than the current progress.
    
    Returns the updated document with reading progress fields.
    """
    try:
        updated_document = await svc.update_reading_progress(
            document_id=document_id,
            user_id=current_user.id,
            block_id=request.block_id,
            position=request.position,
            session=session
        )
        
        return DocumentResponse(
            id=updated_document.id,
            user_id=updated_document.user_id,
            status=updated_document.status,
            title=updated_document.title,
            summary=updated_document.summary,
            created_at=updated_document.created_at,
            updated_at=updated_document.updated_at,
            processing_error=updated_document.processing_error,
            parent_document_id=updated_document.parent_document_id,
            batch_id=updated_document.batch_id,
            chunk_index=updated_document.chunk_index,
            total_chunks=updated_document.total_chunks,
            is_auto_processed=updated_document.is_auto_processed,
            furthest_read_block_id=updated_document.furthest_read_block_id,
            furthest_read_position=updated_document.furthest_read_position,
            furthest_read_updated_at=updated_document.furthest_read_updated_at,
            main_conversation_id=updated_document.main_conversation_id,
            document_info=updated_document.document_info,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied: You don't own this document")
    except Exception as e:
        print(f"[READING_PROGRESS Route] Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[READING_PROGRESS Route] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error updating reading progress: {str(e)}")