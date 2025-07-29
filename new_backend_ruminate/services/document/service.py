# new_backend_ruminate/services/document/service.py
from __future__ import annotations
from typing import Optional, List, BinaryIO
from uuid import uuid4
from datetime import datetime
import asyncio
import json
import io

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.document.entities import Document, DocumentStatus, Page, Block
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface
from new_backend_ruminate.domain.object_storage.storage_interface import ObjectStorageInterface
from new_backend_ruminate.domain.ports.document_analyzer import DocumentAnalyzer
from new_backend_ruminate.infrastructure.document_processing.marker_client import MarkerClient, MarkerResponse
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.infrastructure.db.bootstrap import session_scope


class DocumentService:
    """Service for handling document operations following the established patterns"""
    
    def __init__(
        self,
        repo: DocumentRepositoryInterface,
        hub: EventStreamHub,
        storage: ObjectStorageInterface,
        marker_client: Optional[MarkerClient] = None,
        analyzer: Optional[DocumentAnalyzer] = None
    ) -> None:
        self._repo = repo
        self._hub = hub
        self._storage = storage
        self._marker_client = marker_client or MarkerClient()
        self._analyzer = analyzer
    
    # ─────────────────────────────── helpers ──────────────────────────────── #
    
    async def _process_document_background(self, document_id: str, storage_key: str) -> None:
        """Background task to process document with Marker API"""
        try:
            # Emit processing started event
            event_data = json.dumps({
                "status": DocumentStatus.PROCESSING_MARKER.value,
                "document_id": document_id
            })
            await self._hub.publish(
                f"document_{document_id}",
                f"event: processing_started\ndata: {event_data}\n\n"
            )
            
            async with session_scope() as session:
                # Get document and update status
                document = await self._repo.get_document(document_id, session)
                if not document:
                    return
                
                document.start_marker_processing()
                await self._repo.update_document(document, session)
            
            # Download file from storage
            file_content = await self._storage.download_file(storage_key)
            
            # Process with Marker API
            marker_response = await self._marker_client.process_document(
                file_content=file_content,
                filename=storage_key.split('/')[-1]
            )
            
            if marker_response.status == "error":
                raise Exception(marker_response.error or "Unknown Marker error")
            
            # Parse and save results
            async with session_scope() as session:
                await self._save_marker_results(document_id, marker_response, session)
                
                # Generate document summary if analyzer is available
                print(f"[DocumentService] Analyzer available: {self._analyzer is not None}")
                if self._analyzer:
                    await self._generate_document_summary(document_id, session)
                else:
                    print("[DocumentService] No analyzer configured, skipping summary generation")
                
                # Update document status
                document = await self._repo.get_document(document_id, session)
                document.set_ready()
                await self._repo.update_document(document, session)
            
            # Emit completion event
            event_data = json.dumps({
                "status": DocumentStatus.READY.value,
                "document_id": document_id
            })
            await self._hub.publish(
                f"document_{document_id}",
                f"event: processing_completed\ndata: {event_data}\n\n"
            )
            
        except Exception as e:
            # Update document with error
            async with session_scope() as session:
                document = await self._repo.get_document(document_id, session)
                if document:
                    document.set_error(str(e))
                    await self._repo.update_document(document, session)
            
            # Emit error event
            event_data = json.dumps({
                "status": DocumentStatus.ERROR.value,
                "error": str(e),
                "document_id": document_id
            })
            await self._hub.publish(
                f"document_{document_id}",
                f"event: processing_error\ndata: {event_data}\n\n"
            )
    
    async def _save_marker_results(
        self, 
        document_id: str, 
        marker_response: MarkerResponse,
        session: AsyncSession
    ) -> None:
        """Parse and save Marker API results to database"""
        if not marker_response.pages:
            raise ValueError("No pages returned from Marker API")
        
        pages_to_create = []
        blocks_to_create = []
        
        for idx, page_data in enumerate(marker_response.pages):
            # Create page - use 0-based indexing internally
            page = Page(
                id=str(uuid4()),
                document_id=document_id,
                page_number=idx,
                polygon=page_data.get("polygon"),
                html_content=page_data.get("html", ""),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            pages_to_create.append(page)
            
            # Create blocks for this page
            for block_data in page_data.get("blocks", []):
                block = Block.from_marker_block(
                    marker_block=block_data,
                    document_id=document_id,
                    page_id=page.id,
                    page_number=page.page_number
                )
                blocks_to_create.append(block)
                page.add_block(block.id)
        
        # Save all pages and blocks
        await self._repo.create_pages(pages_to_create, session)
        if blocks_to_create:
            await self._repo.create_blocks(blocks_to_create, session)
    
    async def _generate_document_summary(
        self, 
        document_id: str, 
        session: AsyncSession
    ) -> None:
        """Generate and save document summary using the analyzer"""
        print(f"[DocumentService] Starting summary generation for document {document_id}")
        try:
            # Get document and blocks
            document = await self._repo.get_document(document_id, session)
            blocks = await self._repo.get_blocks_by_document(document_id, session)
            print(f"[DocumentService] Found {len(blocks)} blocks for document {document_id}")
            
            if not blocks:
                return
            
            # Emit status update
            event_data = json.dumps({
                "status": "ANALYZING_CONTENT",
                "document_id": document_id,
                "message": "Generating document summary..."
            })
            await self._hub.publish(
                f"document_{document_id}",
                f"event: analysis_started\ndata: {event_data}\n\n"
            )
            
            # Generate summary
            print(f"[DocumentService] Calling analyzer to generate summary...")
            summary = await self._analyzer.generate_document_summary(
                blocks, 
                document.title
            )
            print(f"[DocumentService] Generated summary: {summary[:100]}...")
            
            # Update document with summary
            document.summary = summary
            await self._repo.update_document(document, session)
            print(f"[DocumentService] Summary saved to document {document_id}")
            
            # Emit completion
            event_data = json.dumps({
                "status": "ANALYSIS_COMPLETE",
                "document_id": document_id,
                "message": "Document summary generated"
            })
            await self._hub.publish(
                f"document_{document_id}",
                f"event: analysis_completed\ndata: {event_data}\n\n"
            )
            
        except Exception as e:
            # Log error but don't fail the entire process
            print(f"[DocumentService] ERROR in summary generation: {type(e).__name__}: {str(e)}")
            import traceback
            print(f"[DocumentService] Traceback: {traceback.format_exc()}")
            
            event_data = json.dumps({
                "status": "ANALYSIS_WARNING",
                "document_id": document_id,
                "message": f"Summary generation failed: {str(e)}"
            })
            await self._hub.publish(
                f"document_{document_id}",
                f"event: analysis_warning\ndata: {event_data}\n\n"
            )
    
    # ───────────────────────────── public API ─────────────────────────────── #
    
    async def upload_document(
        self,
        *,
        background: BackgroundTasks,
        file: BinaryIO,
        filename: str,
        user_id: str,
    ) -> Document:
        """
        Upload a document and start processing
        Returns document immediately while processing continues in background
        """
        # Create document record
        document = Document(
            id=str(uuid4()),
            user_id=user_id,
            title=filename,
            status=DocumentStatus.PENDING,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        async with session_scope() as session:
            # Save document to database
            document = await self._repo.create_document(document, session)
        
        # Upload file to storage
        try:
            storage_key = f"documents/{document.id}/{filename}"
            await self._storage.upload_file(
                file=file,
                key=storage_key,
                content_type="application/pdf"
            )
            
            # Update document with storage key for consistent access
            async with session_scope() as session:
                document.s3_pdf_path = storage_key
                document = await self._repo.update_document(document, session)
                
        except Exception as e:
            async with session_scope() as session:
                document.set_error(f"Failed to upload file: {str(e)}")
                await self._repo.update_document(document, session)
            raise
        
        # Start background processing
        background.add_task(
            self._process_document_background,
            document.id,
            storage_key
        )
        
        return document
    
    async def get_document(self, document_id: str, user_id: str, session: AsyncSession) -> Optional[Document]:
        """Get document by ID, with user ownership validation"""
        document = await self._repo.get_document(document_id, session)
        if document and document.user_id != user_id:
            raise PermissionError("Access denied: You don't own this document")
        return document
    
    async def list_documents(self, user_id: str, session: AsyncSession) -> List[Document]:
        """List documents for the authenticated user"""
        return await self._repo.get_documents_by_user(user_id, session)
    
    async def get_document_pages(self, document_id: str, user_id: str, session: AsyncSession) -> List[Page]:
        """Get all pages for a document, with user ownership validation"""
        # Validate user owns the document
        await self.get_document(document_id, user_id, session)
        return await self._repo.get_pages_by_document(document_id, session)
    
    async def get_document_blocks(
        self, 
        document_id: str, 
        page_number: Optional[int],
        user_id: str,
        session: AsyncSession
    ) -> List[Block]:
        """Get blocks for a document, optionally filtered by page, with user ownership validation"""
        # Validate user owns the document
        await self.get_document(document_id, user_id, session)
        blocks = await self._repo.get_blocks_by_document(document_id, session)
        if page_number is not None:
            blocks = [b for b in blocks if b.page_number == page_number]
        
        # Add rabbithole conversation IDs to block metadata
        # Simple query: get all rabbithole conversations for this document and user
        from sqlalchemy import select
        from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
        
        stmt = select(Conversation.id, Conversation.source_block_id).where(
            Conversation.document_id == document_id,
            Conversation.user_id == user_id,
            Conversation.type == ConversationType.RABBITHOLE
        )
        result = await session.execute(stmt)
        rabbithole_convs = result.fetchall()
        
        # Group conversation IDs by block
        block_conversations = {}
        for conv_id, block_id in rabbithole_convs:
            if block_id not in block_conversations:
                block_conversations[block_id] = []
            block_conversations[block_id].append(conv_id)
        
        # Add conversation IDs to block metadata
        for block in blocks:
            if block.id in block_conversations:
                if not block.metadata:
                    block.metadata = {}
                block.metadata["rabbithole_conversation_ids"] = block_conversations[block.id]
        
        return blocks
    
    async def get_document_pdf_url(self, document_id: str, user_id: str, session: AsyncSession, expiration: int = 3600) -> str:
        """
        Get presigned URL for PDF access, with user ownership validation
        Returns presigned URL
        """
        print(f"[DocumentService] Getting PDF URL for document {document_id}")
        
        document = await self.get_document(document_id, user_id, session)
        if not document:
            print(f"[DocumentService] Document {document_id} not found")
            raise ValueError("Document not found")
        
        print(f"[DocumentService] Document found: {document.title}, s3_pdf_path: {document.s3_pdf_path}")
        
        if not document.s3_pdf_path:
            print(f"[DocumentService] No s3_pdf_path for document {document_id}")
            raise ValueError("PDF not found for this document")
        
        try:
            # Handle both old format (full S3 URI) and new format (just the key)
            storage_path = document.s3_pdf_path
            if storage_path.startswith('s3://'):
                # Extract key from full S3 URI: s3://bucket-name/key -> key
                storage_key = '/'.join(storage_path.split('/')[3:])
                print(f"[DocumentService] Converting S3 URI to key: {storage_path} -> {storage_key}")
            else:
                # Already just the key
                storage_key = storage_path
            
            print(f"[DocumentService] Generating presigned URL for key: {storage_key}")
            presigned_url = await self._storage.get_presigned_url(storage_key, expiration)
            print(f"[DocumentService] Successfully generated presigned URL")
            return presigned_url
        except Exception as e:
            print(f"[DocumentService] Error generating presigned URL: {type(e).__name__}: {str(e)}")
            raise ValueError(f"Failed to generate PDF URL: {str(e)}")

    async def get_document_pdf(self, document_id: str, user_id: str, session: AsyncSession) -> tuple[bytes, str]:
        """
        Download the original PDF for a document, with user ownership validation
        Returns (file_content, filename)
        """
        print(f"[DocumentService] Getting PDF for document {document_id}")
        
        document = await self.get_document(document_id, user_id, session)
        if not document:
            print(f"[DocumentService] Document {document_id} not found")
            raise ValueError("Document not found")
        
        print(f"[DocumentService] Document found: {document.title}, s3_pdf_path: {document.s3_pdf_path}")
        
        if not document.s3_pdf_path:
            print(f"[DocumentService] No s3_pdf_path for document {document_id}")
            raise ValueError("PDF not found for this document")
        
        try:
            # Handle both old format (full S3 URI) and new format (just the key)
            storage_path = document.s3_pdf_path
            if storage_path.startswith('s3://'):
                # Extract key from full S3 URI: s3://bucket-name/key -> key
                storage_key = '/'.join(storage_path.split('/')[3:])
                print(f"[DocumentService] Converting S3 URI to key: {storage_path} -> {storage_key}")
            else:
                # Already just the key
                storage_key = storage_path
            
            print(f"[DocumentService] Attempting to download file from storage with key: {storage_key}")
            file_content = await self._storage.download_file(storage_key)
            print(f"[DocumentService] Successfully downloaded {len(file_content)} bytes")
            return file_content, document.title
        except Exception as e:
            print(f"[DocumentService] Error downloading file from storage: {type(e).__name__}: {str(e)}")
            raise ValueError(f"Failed to download PDF: {str(e)}")
    
    async def get_processing_stream(self, document_id: str):
        """Get SSE stream for document processing updates"""
        async def event_generator():
            stream_id = f"document_{document_id}"
            
            # Send initial status
            async with session_scope() as session:
                document = await self._repo.get_document(document_id, session)
                if document:
                    event_data = json.dumps({
                        "status": document.status.value,
                        "document_id": document_id
                    })
                    yield f"event: status_update\ndata: {event_data}\n\n"
            
            # Subscribe to events from hub
            async for chunk in self._hub.register_consumer(stream_id):
                yield chunk
        
        from sse_starlette.sse import EventSourceResponse
        return EventSourceResponse(event_generator())
    
    async def get_term_definition(
        self,
        *,
        document_id: str,
        block_id: str,
        term: str,
        text_start_offset: int,
        text_end_offset: int,
        surrounding_text: Optional[str],
        user_id: str
    ) -> dict:
        """
        Generate a contextual definition for a term within a document.
        
        Returns a dictionary with:
        - term: The term being defined
        - definition: The generated definition
        - context: The context used to generate the definition
        """
        from new_backend_ruminate.domain.conversation.entities.message import Message, Role
        from new_backend_ruminate.dependencies import get_llm_service
        import re
        
        # First, gather all data from DB within session scope
        document_title = None
        document_summary = None
        context_blocks = []
        
        async with session_scope() as session:
            # Verify user has access to document
            document = await self._repo.get_document(document_id, session)
            if not document or (document.user_id and document.user_id != user_id):
                raise ValueError("Document not found or access denied")
            
            document_title = document.title
            document_summary = document.summary
            
            # Get the specific block
            block = await self._repo.get_block(block_id, session)
            if not block or block.document_id != document_id:
                raise ValueError("Block not found or does not belong to document")
            
            # Get surrounding blocks for context (2 blocks before and after)
            all_blocks = await self._repo.get_blocks_by_document(document_id, session)
            
            # Sort blocks by page number and find the target block index
            sorted_blocks = sorted(all_blocks, key=lambda b: (b.page_number or 0, b.id))
            block_index = next((i for i, b in enumerate(sorted_blocks) if b.id == block_id), None)
            
            if block_index is None:
                raise ValueError("Block not found in document")
            
            # Get context blocks (2 before, target, 2 after)
            start_idx = max(0, block_index - 2)
            end_idx = min(len(sorted_blocks), block_index + 3)
            context_blocks = sorted_blocks[start_idx:end_idx]
        
        # Now process the data outside of session scope
        # Build context from blocks
        context_parts = []
        for b in context_blocks:
            if b.html_content:
                # Strip HTML tags for cleaner context
                clean_text = re.sub('<.*?>', '', b.html_content)
                if b.id == block_id:
                    context_parts.append(f"[TARGET BLOCK]: {clean_text}")
                else:
                    context_parts.append(clean_text)
        
        full_context = "\n\n".join(context_parts)
        
        # If surrounding text is provided, add it for extra context
        if surrounding_text:
            full_context = f"Specific context around the term:\n{surrounding_text}\n\n{full_context}"
        
        # Create prompt for LLM
        system_prompt = f"""You are a helpful assistant that provides clear, contextual definitions for technical terms.
        You are looking at a document titled: "{document_title}"
        {f'Document summary: {document_summary}' if document_summary else ''}
        
        Your task is to define the term "{term}" based on how it's used in this specific document.
        Provide a concise but comprehensive definition that someone reading this document would find helpful.
        Focus on the meaning within this document's context, not just a general dictionary definition."""
        
        user_prompt = f"""Please define the term "{term}" based on the following context from the document:

{full_context}

Provide a clear, contextual definition that explains what this term means in this specific document. Make your response BRIEF - only a sentence or two."""
        
        # Get LLM service and generate definition (this is async I/O, not DB)
        llm = get_llm_service()
        messages = [
            Message(id="sys", conversation_id="def", parent_id=None, role=Role.SYSTEM, content=system_prompt, user_id=user_id, version=0),
            Message(id="usr", conversation_id="def", parent_id="sys", role=Role.USER, content=user_prompt, user_id=user_id, version=0)
        ]
        
        definition = await llm.generate_response(messages, model="gpt-4o-mini")
        
        # Save the definition to block metadata
        async with session_scope() as session:
            # Re-fetch the block to update it
            block = await self._repo.get_block(block_id, session)
            if block:
                # Initialize metadata if not exists
                if not block.metadata:
                    block.metadata = {}
                
                # Initialize definitions dict if not exists
                if 'definitions' not in block.metadata:
                    block.metadata['definitions'] = {}
                
                # Store the definition with position information
                # Use offsets as the key for position-based lookup
                definition_key = f"{text_start_offset}-{text_end_offset}"
                block.metadata['definitions'][definition_key] = {
                    'term': term,
                    'definition': definition,
                    'text_start_offset': text_start_offset,
                    'text_end_offset': text_end_offset,
                    'created_at': datetime.now().isoformat()
                }
                
                # Update the block in database
                block.updated_at = datetime.now()
                await self._repo.update_block(block, session)
        
        return {
            "term": term,
            "definition": definition,
            "context": full_context[:500] + "..." if len(full_context) > 500 else full_context
        }