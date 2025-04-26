# services/document/upload_service.py
from typing import Optional, List
import uuid
import asyncio
import logging
from datetime import datetime
from fastapi import UploadFile, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.viewer.page import Page
from src.models.base.document import Document, DocumentStatus
from src.models.viewer.block import Block
from src.repositories.interfaces.document_repository import DocumentRepository
from src.repositories.interfaces.storage_repository import StorageRepository
from src.services.document.marker_service import MarkerService
from src.services.document.critical_content_service import CriticalContentService
from src.api.sse_manager import publish_status, cleanup_queue
import re
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UploadService:
    def __init__(
        self,
        storage_repo: StorageRepository,
        marker: MarkerService,
        critical_content_service: CriticalContentService,
        document_repo: DocumentRepository
    ):
        self.storage_repo = storage_repo
        self.marker = marker
        self.critical_content_service = critical_content_service
        self.document_repo = document_repo
        # The session factory is owned by the repositories and will be accessed 
        # through the document_repo during background processing

    async def _process_document_background(
            self,
            document_id: str,
            file_data: bytes,
            original_filename: str
        ):
        """Runs the document processing in the background."""
        document = None
        # Create a new session for the background task
        async with self.document_repo.get_session() as session:
            try:
                # Fetch the document to update its status
                document = await self.document_repo.get_document(document_id, session)
                if not document:
                    logger.error(f"Document {document_id} not found for background processing.")
                    raise ValueError(f"Document {document_id} not found")

                # 1. Marker Processing
                await publish_status(document_id, {"status": "PROCESSING_LAYOUT", "detail": "Starting layout analysis..."})
                document.status = DocumentStatus.PROCESSING_MARKER 
                await self.document_repo.store_document(document, session) 
                await session.commit()
                logger.info(f"Set document {document_id} status to {document.status}")

                pages, blocks = await self.marker.process_document(file_data, document_id)
                await self.document_repo.store_pages(pages, session)
                await self.document_repo.store_blocks(blocks, session)
                await publish_status(document_id, {"status": "PROCESSING_LAYOUT_COMPLETE", "detail": f"Layout analysis complete. Found {len(pages)} pages, {len(blocks)} blocks."})

                # 2. Document Summary
                await publish_status(document_id, {"status": "GENERATING_SUMMARY", "detail": "Generating document summary..."})
                summary = await self.critical_content_service._get_document_summary(blocks)
                document.summary = summary
                await self.document_repo.store_document(document, session) 
                await publish_status(document_id, {"status": "GENERATING_SUMMARY_COMPLETE", "detail": "Document summary generated."})

                # 3. Chunking
                await publish_status(document_id, {"status": "CHUNKING", "detail": "Chunking document content..."})
                await publish_status(document_id, {"status": "CHUNKING_COMPLETE", "detail": "Chunking complete."})

                # 4. Finalize - Set status to READY
                document.status = DocumentStatus.READY
                document.updated_at = datetime.now()
                await self.document_repo.store_document(document, session)
                await publish_status(document_id, {"status": "READY", "detail": "Document is ready."})
                logger.info(f"Document {document_id} processing complete and set to READY.")

            except Exception as e:
                logger.error(f"Error processing document {document_id} in background: {e}", exc_info=True)
                if document: 
                     document.status = DocumentStatus.ERROR
                     document.processing_error = str(e)
                     document.updated_at = datetime.now()
                     await self.document_repo.store_document(document, session) 
                await publish_status(document_id, {"status": "ERROR", "detail": f"Processing failed: {e}"}) 
            finally:
                await cleanup_queue(document_id)
                await session.commit() 


    async def upload(
            self,
            file: UploadFile,
            background_tasks: BackgroundTasks, 
            session: Optional[AsyncSession] = None,
            user_id: str = None
        ) -> Document:
        """Accepts a document upload, creates a record, starts background processing, and returns the initial document object immediately."""
        file_data = await file.read()
        document = Document(
            user_id=user_id,
            title=file.filename,
            status=DocumentStatus.PENDING, 
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        try:
            await self.document_repo.store_document(document, session)
            await session.flush() 
            # await session.refresh(document) # Removed: This causes UnmappedInstanceError because repo uses raw SQL
            logger.info(f"Created initial document record with ID: {document.id}, status: {document.status}")

            s3_path = await self.storage_repo.store_file(file_data, document.id, session)
            document.s3_pdf_path = s3_path
            await self.document_repo.store_document(document, session) 

            # Make sure we commit before starting the background task
            await session.commit()
            
            background_tasks.add_task(
                self._process_document_background,
                document_id=document.id,
                file_data=file_data,
                original_filename=file.filename
            )
            logger.info(f"Scheduled background processing for document {document.id}")

            return document

        except Exception as e:
            logger.error(f"Error during initial upload for {file.filename}: {e}", exc_info=True)
            if document and document.id:
                try:
                    document.status = DocumentStatus.ERROR
                    document.processing_error = f"Initial upload failed: {e}"
                    await self.document_repo.store_document(document, session)
                    await session.commit()
                except Exception as db_err:
                    logger.error(f"Failed to update document status to ERROR after initial upload failure: {db_err}")
                    await session.rollback() 
            else:
                 await session.rollback() 
            raise HTTPException(status_code=500, detail=f"Failed to initiate document upload: {e}")