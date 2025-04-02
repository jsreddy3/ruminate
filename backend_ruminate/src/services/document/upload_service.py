# services/document/upload_service.py
from typing import Optional, List
import uuid
import asyncio
import logging
from datetime import datetime
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.viewer.page import Page
from src.models.base.document import Document, DocumentStatus
from src.models.viewer.block import Block
from src.repositories.interfaces.document_repository import DocumentRepository
from src.repositories.interfaces.storage_repository import StorageRepository
from src.services.document.marker_service import MarkerService
from src.services.document.critical_content_service import CriticalContentService
from src.services.document.chunking_service import ChunkingService
import re
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UploadService:
    def __init__(self, document_repository: DocumentRepository, 
                 storage_repository: StorageRepository, 
                 marker_service: MarkerService, 
                 critical_content_service: CriticalContentService,
                 chunking_service: ChunkingService,
                 rumination_service=None):
        self.document_repo = document_repository
        self.storage_repo = storage_repository
        self.marker = marker_service
        self.critical_content_service = critical_content_service
        self.rumination_service = rumination_service
        self.chunking_service = chunking_service

    async def upload(self, file: UploadFile, session: Optional[AsyncSession] = None, user_id: str = None) -> Document:
        """Upload a document and process it for viewing"""
        document = Document(
            user_id=user_id,
            title=file.filename,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        file_data = await file.read()
        
        try:
            # Store document first
            await self.document_repo.store_document(document, session)
            
            # Run storage and Marker in parallel
            s3_path = await self.storage_repo.store_file(file_data, document.id, session)
            document.s3_pdf_path = s3_path
            logger.info("Starting marker processing!")
            document.start_marker_processing()
            
            # Pass document_id to marker service
            pages, blocks = await self.marker.process_document(file_data, document.id)
            # Store pages and blocks
            await self.document_repo.store_pages(pages, session)
            await self.document_repo.store_blocks(blocks, session)

            # document.start_rumination_processing()
            # logger.info("Ruminations would happen here!")
            # chunks, excerpts = await self.rumination_service.split_document(blocks)
            # await self.document_repo.store_chunks(chunks, session)
            # await self.document_repo.store_excerpts(excerpts, session)
            # After blocks are created, analyze critical content in background
            # await self.rumination_service.process_document(document)
            # Get document summary
            summary = await self.critical_content_service._get_document_summary(blocks)
            document.summary = summary  # Store summary in document
            document.set_ready()
            await self.document_repo.store_document(document, session)  # Update document status
            # asyncio.create_task(self._analyze_critical_content(blocks, summary))

            # <----> CHUNKING HERE <---->
            chunks = await self.chunking_service.process_document(blocks)
            
            # Store the chunks in the database
            await self.document_repo.store_chunks(chunks, session)
            logger.info(f"Stored {len(chunks)} chunks for document {document.id}")
            
            return document
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            document.set_error(str(e))
            await self.document_repo.store_document(document, session)  # Store error status
            raise

    async def _analyze_critical_content(self, blocks: List[Block], summary: str):
        """Background task to analyze critical content in blocks"""
        try:
            await self.critical_content_service._analyze_critical_blocks(blocks, summary)
            await self.document_repo.store_blocks(blocks)
        except Exception as e:
            logger.error(f"Error in critical content analysis: {str(e)}")