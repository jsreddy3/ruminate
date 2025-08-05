# new_backend_ruminate/services/document/service.py
from __future__ import annotations
from typing import Optional, List, BinaryIO, Dict, Any, Tuple
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
from new_backend_ruminate.domain.ports.llm import LLMService
from new_backend_ruminate.infrastructure.document_processing.marker_client import MarkerClient, MarkerResponse
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.infrastructure.db.bootstrap import session_scope
from new_backend_ruminate.context.renderers.note_generation import NoteGenerationContext
from new_backend_ruminate.services.chunk import ChunkService


class DocumentService:
    """Service for handling document operations following the established patterns"""
    
    def __init__(
        self,
        repo: DocumentRepositoryInterface,
        hub: EventStreamHub,
        storage: ObjectStorageInterface,
        llm: Optional[LLMService] = None,
        marker_client: Optional[MarkerClient] = None,
        analyzer: Optional[DocumentAnalyzer] = None,
        note_context: Optional[NoteGenerationContext] = None,
        conversation_service = None,  # Type hint avoided due to circular imports
        chunk_service: Optional[ChunkService] = None
    ) -> None:
        self._repo = repo
        self._hub = hub
        self._storage = storage
        self._llm = llm
        self._marker_client = marker_client or MarkerClient()
        self._analyzer = analyzer
        self._note_context = note_context
        self._conversation_service = conversation_service
        self._chunk_service = chunk_service
    
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
                if self._analyzer:
                    await self._generate_document_summary(document_id, session)
                
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
        
        # Create chunks for the document
        total_pages = len(marker_response.pages)
        chunks = await self._chunk_service.create_chunks_for_document(
            document_id=document_id,
            total_pages=total_pages,
            session=session
        )
        
        # Create a mapping of page numbers to chunk IDs
        chunk_map = {}
        for chunk in chunks:
            for page_num in range(chunk.start_page, chunk.end_page):
                chunk_map[page_num] = chunk.id
        
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
            
            # Get chunk_id for this page
            chunk_id = chunk_map.get(idx)
            
            # Create blocks for this page
            for block_data in page_data.get("blocks", []):
                block = Block.from_marker_block(
                    marker_block=block_data,
                    document_id=document_id,
                    page_id=page.id,
                    page_number=page.page_number
                )
                # Assign chunk_id to block
                block.chunk_id = chunk_id
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
        """Generate and save document summary and info using the analyzer"""
        try:
            # Get document and blocks
            document = await self._repo.get_document(document_id, session)
            blocks = await self._repo.get_blocks_by_document(document_id, session)
            
            if not blocks:
                return
            
            # Emit status update
            event_data = json.dumps({
                "status": "ANALYZING_CONTENT",
                "document_id": document_id,
                "message": "Analyzing document content..."
            })
            await self._hub.publish(
                f"document_{document_id}",
                f"event: analysis_started\ndata: {event_data}\n\n"
            )
            
            # Generate both summary and document info in parallel
            import asyncio
            
            # Run both analyses concurrently
            summary_task = self._analyzer.generate_document_summary(blocks, document.title)
            info_task = self._analyzer.generate_document_info(blocks, document.title)
            
            summary, doc_info = await asyncio.gather(summary_task, info_task)
            
            # Update document with summary and info
            document.summary = summary
            
            # Store the structured info as JSON in document_info field
            import json as json_module
            document.document_info = json_module.dumps(doc_info)
            
            # Update the document title with the extracted title if available
            if doc_info.get("title") and doc_info["title"] != document.title:
                print(f"[DocumentService] Updating document title from '{document.title}' to '{doc_info['title']}'")
                document.title = doc_info["title"]
            
            await self._repo.update_document(document, session)
            
            # Emit completion
            event_data = json.dumps({
                "status": "ANALYSIS_COMPLETE",
                "document_id": document_id,
                "message": "Document analysis completed",
                "extracted_info": doc_info
            })
            await self._hub.publish(
                f"document_{document_id}",
                f"event: analysis_completed\ndata: {event_data}\n\n"
            )
            
        except Exception as e:
            # Log error but don't fail the entire process
            print(f"[DocumentService] ERROR in document analysis: {type(e).__name__}: {str(e)}")
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
    
    def _get_pdf_page_count(self, file_content: bytes) -> int:
        """Get the number of pages in a PDF file"""
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            page_count = len(reader.pages)
            return page_count
        except Exception as e:
            import traceback
            print(f"[DocumentService] Traceback: {traceback.format_exc()}")
            # Default to assuming it's a large document if we can't read it
            return 50  # Assume large document to be safe
    
    def _split_pdf_into_chunks(self, file_content: bytes, pages_per_chunk: int = 20) -> List[bytes]:
        """Split PDF into smaller chunks of specified page count"""
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            total_pages = len(reader.pages)
            chunks = []
            
            for start_page in range(0, total_pages, pages_per_chunk):
                end_page = min(start_page + pages_per_chunk, total_pages)
                
                # Create a new PDF with the chunk pages
                writer = PyPDF2.PdfWriter()
                for page_num in range(start_page, end_page):
                    writer.add_page(reader.pages[page_num])
                
                # Write to bytes
                chunk_buffer = io.BytesIO()
                writer.write(chunk_buffer)
                chunk_buffer.seek(0)
                chunks.append(chunk_buffer.getvalue())
            
            return chunks
        except Exception as e:
            import traceback
            print(f"[DocumentService] Traceback: {traceback.format_exc()}")
            # If splitting fails, return the original file as a single chunk
            return [file_content]
    
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
        For large documents (>20 pages), creates batch with first chunk auto-processing
        Returns the first document while batch creation continues in background
        """
        # Read file content once
        try:
            file_content = file.read()
            file.seek(0)  # Reset for any subsequent reads
        except Exception as e:
            print(f"[DocumentService] Error reading file: {type(e).__name__}: {str(e)}")
            raise ValueError(f"Failed to read file: {str(e)}")
                
        # Check PDF page count to determine if we need batch processing
        page_count = self._get_pdf_page_count(file_content)
        
        if page_count <= 20:
            # Single document processing (existing flow)
            return await self._upload_single_document(
                background=background,
                file_content=file_content,
                filename=filename,
                user_id=user_id
            )
        else:
            # Batch processing for large documents
            return await self._upload_batch_document(
                background=background,
                file_content=file_content,
                filename=filename,
                user_id=user_id,
                total_pages=page_count
            )
    
    async def _upload_single_document(
        self,
        *,
        background: BackgroundTasks,
        file_content: bytes,
        filename: str,
        user_id: str,
    ) -> Document:
        """Upload and process a single document (existing logic)"""
        # Create document record
        document = Document(
            id=str(uuid4()),
            user_id=user_id,
            title=filename,
            status=DocumentStatus.PENDING,
            is_auto_processed=True,  # Single documents auto-process
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        async with session_scope() as session:
            # Save document to database
            document = await self._repo.create_document(document, session)
            
            # Create main conversation for the document
            if self._conversation_service:
                try:
                    print(f"[DocumentService] Creating main conversation for document {document.id}")
                    main_conversation_id, _ = await self._conversation_service.create_conversation(
                        user_id=user_id,
                        conv_type="chat",
                        document_id=document.id
                    )
                    print(f"[DocumentService] Created main conversation {main_conversation_id}")
                    # Store the main conversation ID in document
                    document.main_conversation_id = main_conversation_id
                    print(f"[DocumentService] Set document.main_conversation_id = {main_conversation_id}")
                    document = await self._repo.update_document(document, session)
                    print(f"[DocumentService] Updated document, main_conversation_id = {document.main_conversation_id}")
                except Exception as e:
                    print(f"[DocumentService] Warning: Failed to create main conversation: {e}")
                    import traceback
                    traceback.print_exc()
                    # Don't fail document creation if conversation creation fails
            else:
                print(f"[DocumentService] No conversation service available")
        
        # Upload file to storage
        try:
            storage_key = f"documents/{document.id}/{filename}"
            await self._storage.upload_file(
                file=io.BytesIO(file_content),
                key=storage_key,
                content_type="application/pdf"
            )
            
            # Update document with storage key
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
    
    async def _upload_batch_document(
        self,
        *,
        background: BackgroundTasks,
        file_content: bytes,
        filename: str,
        user_id: str,
        total_pages: int,
    ) -> Document:
        """Upload and create batch documents for large PDFs"""
        batch_id = str(uuid4())
        pages_per_chunk = 20
        total_chunks = (total_pages + pages_per_chunk - 1) // pages_per_chunk
        
        # Split PDF into chunks
        pdf_chunks = self._split_pdf_into_chunks(file_content, pages_per_chunk)
        documents = []
        
        try:
            async with session_scope() as session:
                # Create all document records in batch
                for i, chunk_content in enumerate(pdf_chunks):
                    chunk_title = f"{filename} (Part {i+1} of {total_chunks})"
                    is_first_chunk = i == 0
                    
                    document = Document(
                        id=str(uuid4()),
                        user_id=user_id,
                        title=chunk_title,
                        status=DocumentStatus.PENDING if is_first_chunk else DocumentStatus.AWAITING_PROCESSING,
                        batch_id=batch_id,
                        chunk_index=i,
                        total_chunks=total_chunks,
                        is_auto_processed=is_first_chunk,  # Only first chunk auto-processes
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    
                    # Save to database
                    document = await self._repo.create_document(document, session)
                    
                    # Create main conversation for each chunk
                    if self._conversation_service:
                        try:
                            main_conversation_id, _ = await self._conversation_service.create_conversation(
                                user_id=user_id,
                                conv_type="chat",
                                document_id=document.id
                            )
                            # Store the main conversation ID in document
                            document.main_conversation_id = main_conversation_id
                            document = await self._repo.update_document(document, session)
                        except Exception as e:
                            print(f"[DocumentService] Warning: Failed to create main conversation: {e}")
                            # Don't fail document creation if conversation creation fails
                    
                    documents.append((document, chunk_content))
            
            # Upload all chunks to storage and start processing first chunk
            first_document = None
            for idx, (document, chunk_content) in enumerate(documents):
                storage_key = f"documents/{batch_id}/chunk-{document.chunk_index}.pdf"
                
                await self._storage.upload_file(
                    file=io.BytesIO(chunk_content),
                    key=storage_key,
                    content_type="application/pdf"
                )
                
                # Update document with storage key
                async with session_scope() as session:
                    document.s3_pdf_path = storage_key
                    updated_document = await self._repo.update_document(document, session)
                
                # Keep reference to first chunk and start processing it
                if idx == 0:  # First document in the list
                    first_document = updated_document
                    background.add_task(
                        self._process_document_background,
                        first_document.id,
                        storage_key
                    )
            
            if not first_document:
                raise ValueError("Failed to create batch documents - no first document found")
            
            return first_document
            
        except Exception as e:
            # Clean up on error
            async with session_scope() as session:
                for document, _ in documents:
                    document.set_error(f"Failed to upload batch: {str(e)}")
                    await self._repo.update_document(document, session)
            raise
    
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
        document = await self.get_document(document_id, user_id, session)
        if not document:
            raise ValueError("Document not found")
        
        if not document.s3_pdf_path:
            raise ValueError("PDF not found for this document")
        
        try:
            # Handle both old format (full S3 URI) and new format (just the key)
            storage_path = document.s3_pdf_path
            if storage_path.startswith('s3://'):
                # Extract key from full S3 URI: s3://bucket-name/key -> key
                storage_key = '/'.join(storage_path.split('/')[3:])
            else:
                # Already just the key
                storage_key = storage_path
            
            presigned_url = await self._storage.get_presigned_url(storage_key, expiration)
            return presigned_url
        except Exception as e:
            raise ValueError(f"Failed to generate PDF URL: {str(e)}")

    async def get_document_pdf(self, document_id: str, user_id: str, session: AsyncSession) -> tuple[bytes, str]:
        """
        Download the original PDF for a document, with user ownership validation
        Returns (file_content, filename)
        """
        document = await self.get_document(document_id, user_id, session)
        if not document:
            raise ValueError("Document not found")
        
        if not document.s3_pdf_path:
            raise ValueError("PDF not found for this document")
        
        try:
            # Handle both old format (full S3 URI) and new format (just the key)
            storage_path = document.s3_pdf_path
            if storage_path.startswith('s3://'):
                # Extract key from full S3 URI: s3://bucket-name/key -> key
                storage_key = '/'.join(storage_path.split('/')[3:])
            else:
                # Already just the key
                storage_key = storage_path
            
            file_content = await self._storage.download_file(storage_key)
            return file_content, document.title
        except Exception as e:
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

Provide a clear, contextual definition that explains what this term means in this specific document. Make your response BRIEF - only a sentence or two.
DO NOT say things like "in this document" or anything - imagine you're just providing a short, concise note that, with no filler, has EVERY WORD be useful."""
        
        # Get LLM service and generate definition (this is async I/O, not DB)
        if not self._llm:
            raise ValueError("LLM service not configured")
            
        messages = [
            Message(id="sys", conversation_id="def", parent_id=None, role=Role.SYSTEM, content=system_prompt, user_id=user_id, version=0),
            Message(id="usr", conversation_id="def", parent_id="sys", role=Role.USER, content=user_prompt, user_id=user_id, version=0)
        ]
        
        definition = await self._llm.generate_response(messages, model="gpt-4o-mini", enable_web_search=False)
        
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
            "text_start_offset": text_start_offset,
            "text_end_offset": text_end_offset,
            "created_at": datetime.now().isoformat(),
            "context": full_context[:500] + "..." if len(full_context) > 500 else full_context,
            "block_id": block_id
        }
    
    async def update_block_annotation(
        self,
        *,
        document_id: str,
        block_id: str,
        text: str,
        note: str,
        text_start_offset: int,
        text_end_offset: int,
        user_id: str,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """
        Update block annotation - handles create, update, and delete.
        
        - If note is empty string, deletes the annotation
        - If annotation exists at given offsets, updates it
        - Otherwise creates a new annotation
        
        Returns:
            Dictionary containing the annotation data or None if deleted
        """
        import uuid
        from datetime import datetime
        
        # Verify user has access to document and block exists
        document = await self._repo.get_document(document_id, session)
        if not document or (document.user_id and document.user_id != user_id):
            raise ValueError("Document not found or access denied")
        
        block = await self._repo.get_block(block_id, session)
        if not block or block.document_id != document_id:
            raise ValueError("Block not found or does not belong to document")
        
        # Initialize metadata if not exists
        if not block.metadata:
            block.metadata = {}
        
        # Initialize annotations dict if not exists
        if 'annotations' not in block.metadata:
            block.metadata['annotations'] = {}
        
        annotation_key = f"{text_start_offset}-{text_end_offset}"
        
        # Delete if note is empty
        if not note:
            if annotation_key in block.metadata['annotations']:
                del block.metadata['annotations'][annotation_key]
                # Clean up empty annotations dict
                if not block.metadata['annotations']:
                    del block.metadata['annotations']
            # Update the block in database
            block.updated_at = datetime.now()
            await self._repo.update_block(block, session)
            return None
        else:
            # Create or update annotation
            existing = block.metadata['annotations'].get(annotation_key)
            
            annotation_data = {
                'id': existing['id'] if existing else str(uuid.uuid4()),
                'text': text,
                'note': note,
                'text_start_offset': text_start_offset,
                'text_end_offset': text_end_offset,
                'created_at': existing['created_at'] if existing else datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            block.metadata['annotations'][annotation_key] = annotation_data
            
            # Update the block in database
            block.updated_at = datetime.now()
            await self._repo.update_block(block, session)
            
            return annotation_data
    
    async def generate_note_from_conversation(
        self,
        *,
        conversation_id: str,
        block_id: str,
        messages: List[Any],  # Message objects from conversation
        message_count: int = 5,
        topic: Optional[str] = None,
        user_id: str,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """
        Generate a note from conversation messages and save it to a block.
        
        Args:
            conversation_id: ID of the source conversation
            block_id: Target block to attach the note to
            messages: List of message objects from the conversation
            message_count: Number of recent messages to include (default: 5)
            topic: Optional topic/focus for the note generation
            user_id: User ID for permission checking
            session: Database session
            
        Returns:
            Dictionary with generated note content and metadata
        """
        from new_backend_ruminate.domain.conversation.entities.message import Message, Role
        import uuid
        
        # Verify user has access to the block
        block = await self._repo.get_block(block_id, session)
        if not block:
            raise ValueError("Block not found")
            
        document = await self._repo.get_document(block.document_id, session)
        if not document or (document.user_id and document.user_id != user_id):
            raise ValueError("Document not found or access denied")
        
        # Filter to get user/assistant messages only (skip system/tool messages)
        conversation_messages = [
            msg for msg in messages 
            if msg.role in ["USER", "ASSISTANT"]  # Use uppercase string values to match database
        ]
        
        # Take the most recent messages based on message_count
        recent_messages = conversation_messages[-message_count:] if len(conversation_messages) > message_count else conversation_messages
        
        # Build context for note generation using injected context builder
        if not self._note_context:
            raise ValueError("Note generation context not configured")
            
        llm_messages = self._note_context.build_context(
            document=document,
            block=block,
            conversation_messages=recent_messages,
            topic=topic,
            user_id=user_id
        )
        
        # Generate note using LLM
        if not self._llm:
            raise ValueError("LLM service not configured")
            
        generated_note = await self._llm.generate_response(llm_messages, model="gpt-4o-mini")
        
        # Save the note to block metadata
        note_metadata = await self._save_generated_note(
            block=block,
            note_content=generated_note,
            conversation_id=conversation_id,
            message_count=len(recent_messages),
            topic=topic,
            recent_messages=recent_messages,
            session=session
        )
        
        # Add reverse reference to the most recent message that was summarized
        # This creates a bidirectional link between conversation and generated summary
        if recent_messages:
            most_recent_message = recent_messages[-1]  # Last message in the summarized range
            
            # Get current metadata or initialize empty dict
            current_metadata = most_recent_message.meta_data or {}
            
            # Add reference to generated summary
            if "generated_summaries" not in current_metadata:
                current_metadata["generated_summaries"] = []
            
            summary_ref = {
                "note_id": note_metadata['id'],
                "block_id": block_id,
                "summary_content": generated_note,  # Store the actual summary content
                "summary_range": {
                    "from_message_id": recent_messages[0].id,
                    "message_count": len(recent_messages),
                    "topic": topic
                },
                "created_at": datetime.now().isoformat()
            }
            current_metadata["generated_summaries"].append(summary_ref)
            
            # Update message metadata - we need to inject the conversation service
            # For now, directly update through the repository to avoid circular dependencies
            try:
                from new_backend_ruminate.infrastructure.conversation.rds_conversation_repository import RDSConversationRepository
                conv_repo = RDSConversationRepository()
                await conv_repo.update_message_metadata(
                    mid=most_recent_message.id,
                    meta_data=current_metadata,
                    session=session
                )
                    
            except Exception as e:
                pass
                import traceback
                traceback.print_exc()
        
        return {
            "note": generated_note,
            "note_id": note_metadata['id'],
            "block_id": block_id,
            "conversation_id": conversation_id
        }
    
    async def _save_generated_note(
        self,
        block: Block,
        note_content: str,
        conversation_id: str,
        message_count: int,
        topic: Optional[str],
        recent_messages: List,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """Save generated note to block metadata"""
        import uuid
        
        if not block.metadata:
            block.metadata = {}
        
        if 'annotations' not in block.metadata:
            block.metadata['annotations'] = {}
        
        # Create a unique key for the generated note
        note_id = str(uuid.uuid4())
        annotation_key = f"generated-{note_id}"
        
        # Store the note with special metadata
        note_metadata = {
            'id': note_id,
            'text': '[Generated from conversation]',
            'note': note_content,
            'text_start_offset': -1,  # Special value to indicate generated note
            'text_end_offset': -1,
            'is_generated': True,
            'source_conversation_id': conversation_id,
            'from_message_id': recent_messages[0].id if recent_messages else None,  # NEW: Link to source message
            'message_count': message_count,
            'topic': topic,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        block.metadata['annotations'][annotation_key] = note_metadata
        
        # Update the block in database
        block.updated_at = datetime.now()
        await self._repo.update_block(block, session)
        
        return note_metadata
    
    async def update_document(self, document_id: str, user_id: str, updates: Dict[str, Any], session: AsyncSession) -> Document:
        """
        Update document metadata.
        
        Args:
            document_id: The document ID to update
            user_id: The user requesting the update (for ownership verification)
            updates: Dictionary of fields to update (e.g., {"title": "New Title"})
            session: Database session
            
        Returns:
            Updated document entity
            
        Raises:
            ValueError: If document not found or user doesn't own it
        """
        # Get and validate document
        document = await self.get_document(document_id, user_id, session)
        if not document:
            raise ValueError("Document not found")
        
        # Apply updates
        for field, value in updates.items():
            if hasattr(document, field):
                setattr(document, field, value)
            else:
                raise ValueError(f"Invalid field: {field}")
        
        # Update timestamp and save
        document.updated_at = datetime.now()
        updated_document = await self._repo.update_document(document, session)
        
        return updated_document

    async def delete_document(self, document_id: str, user_id: str, session: AsyncSession) -> bool:
        """
        Delete a document and all its associated data (cascade delete).
        
        This will delete:
        - The document record
        - All pages belonging to the document
        - All blocks belonging to the document
        - PDF file from object storage
        
        Args:
            document_id: ID of the document to delete
            user_id: ID of the user requesting deletion (for ownership validation)
            session: Database session
            
        Returns:
            bool: True if document was deleted, False if not found
            
        Raises:
            PermissionError: If user doesn't own the document
        """
        # First verify the document exists and user owns it
        document = await self.get_document(document_id, user_id, session)
        if not document:
            return False
        
        try:
            # Delete PDF file from object storage if it exists
            if document.s3_pdf_path:
                try:
                    # Handle both old format (full S3 URI) and new format (just the key)
                    storage_path = document.s3_pdf_path
                    if storage_path.startswith('s3://'):
                        # Extract key from full S3 URI: s3://bucket-name/key -> key
                        storage_key = '/'.join(storage_path.split('/')[3:])
                    else:
                        # Already just the key
                        storage_key = storage_path
                    
                    deleted = await self._storage.delete_file(storage_key)
                    if deleted:
                        print(f"[DocumentService] Successfully deleted PDF from storage")
                    else:
                        print(f"[DocumentService] PDF file not found in storage (may have been already deleted)")
                except Exception as storage_error:
                    # Log but don't fail the entire delete operation
                    print(f"[DocumentService] Warning: Failed to delete PDF from storage: {storage_error}")
            
            # Delete document from database (this will cascade to pages and blocks)
            deleted = await self._repo.delete_document(document_id, session)
            
            if deleted:
                print(f"[DocumentService] Document not found in database: {document_id}")
            
            return deleted
            
        except Exception as e:
            print(f"[DocumentService] Error deleting document {document_id}: {type(e).__name__}: {str(e)}")
            raise ValueError(f"Failed to delete document: {str(e)}")
    
    async def update_reading_progress(
        self,
        document_id: str,
        user_id: str,
        block_id: str,
        position: int,
        session: AsyncSession
    ) -> Document:
        """
        Update reading progress for a document.
        Only updates if the new position is further than the current position.
        
        Args:
            document_id: ID of the document
            user_id: User ID for permission checking
            block_id: ID of the furthest read block
            position: Position of the block in reading order
            session: Database session
            
        Returns:
            Updated document entity
            
        Raises:
            ValueError: If document not found or user doesn't own it
            PermissionError: If user doesn't have access to the document
        """
        # Get and validate document
        document = await self.get_document(document_id, user_id, session)
        if not document:
            raise ValueError("Document not found")
        
        # Verify the block exists and belongs to this document
        block = await self._repo.get_block(block_id, session)
        if not block or block.document_id != document_id:
            raise ValueError("Block not found or does not belong to document")
        
        # Only update if this position is further than current progress
        current_position = document.furthest_read_position or -1
        if position > current_position:
            # Update reading progress
            document.update_reading_progress(block_id, position)
            
            # Save to database
            updated_document = await self._repo.update_document(document, session)
            
            return updated_document
        else:
            return document
    
    async def start_chunk_processing(
        self,
        document_id: str,
        user_id: str,
        background: BackgroundTasks,
        session: AsyncSession
    ) -> Document:
        """
        Start processing for a document chunk that's in AWAITING_PROCESSING status
        
        Args:
            document_id: ID of the document to start processing
            user_id: User ID for permission checking
            background: FastAPI background tasks
            session: Database session
            
        Returns:
            Updated document with PENDING status
            
        Raises:
            ValueError: If document not found, not owned by user, or not in correct status
        """
        # Get and validate document
        document = await self.get_document(document_id, user_id, session)
        if not document:
            raise ValueError("Document not found")
        
        # Check if document is in correct status
        if document.status != DocumentStatus.AWAITING_PROCESSING:
            raise ValueError(f"Document is not awaiting processing (current status: {document.status})")
        
        # Check if document has storage path
        if not document.s3_pdf_path:
            raise ValueError("Document has no associated PDF file")
        
        try:
            # Update status to PENDING
            document.status = DocumentStatus.PENDING
            document.updated_at = datetime.now()
            await self._repo.update_document(document, session)
            
            # Start background processing
            background.add_task(
                self._process_document_background,
                document.id,
                document.s3_pdf_path
            )
            
            return document
            
        except Exception as e:
            # Revert status on error
            document.set_error(f"Failed to start processing: {str(e)}")
            await self._repo.update_document(document, session)
            raise ValueError(f"Failed to start processing: {str(e)}")