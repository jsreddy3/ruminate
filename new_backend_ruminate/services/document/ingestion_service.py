# new_backend_ruminate/services/document/ingestion_service.py
from __future__ import annotations
from typing import Optional
from uuid import uuid4
from datetime import datetime
import io

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.document.entities import Document, DocumentStatus
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface
from new_backend_ruminate.domain.object_storage.storage_interface import ObjectStorageInterface
from new_backend_ruminate.infrastructure.db.bootstrap import session_scope


class IngestionService:
    """Handles creation and queuing of document processing without materializing PDFs in the API."""

    def __init__(
        self,
        repo: DocumentRepositoryInterface,
        storage: ObjectStorageInterface,
        processing_queue: Optional[object] = None,
        conversation_service: Optional[object] = None,
    ) -> None:
        self._repo = repo
        self._storage = storage
        self._processing_queue = processing_queue
        self._conversation_service = conversation_service

    async def create_document_and_enqueue(
        self,
        *,
        user_id: str,
        filename: str,
        s3_key: Optional[str] = None,
        file_stream: Optional[io.BufferedReader] = None,
    ) -> Document:
        """Create a document, ensure file in storage, and enqueue processing job."""
        # Create document row
        document = Document(
            id=str(uuid4()),
            user_id=user_id,
            title=filename,
            status=DocumentStatus.PENDING,
            is_auto_processed=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        async with session_scope() as session:
            document = await self._repo.create_document(document, session)

            # Create main conversation for the document (best-effort)
            if self._conversation_service:
                try:
                    main_conversation_id, _ = await self._conversation_service.create_conversation(
                        user_id=user_id,
                        conv_type="chat",
                        document_id=document.id,
                    )
                    document.main_conversation_id = main_conversation_id
                    document = await self._repo.update_document(document, session)
                except Exception:
                    print("Error creating main conversation")

        # Ensure file is in storage
        if s3_key:
            storage_key = s3_key
        elif file_stream is not None:
            storage_key = f"documents/{document.id}/{filename}"
            await self._storage.upload_file(
                file=file_stream,
                key=storage_key,
                content_type="application/pdf",
            )
        else:
            raise ValueError("Must provide either s3_key or file_stream")

        # Update document with storage key
        async with session_scope() as session:
            document.s3_pdf_path = storage_key
            document = await self._repo.update_document(document, session)

        # Enqueue processing job (if configured) or return for fallback processing
        if self._processing_queue:
            job = {
                "type": "process_document",
                "document_id": document.id,
                "storage_key": storage_key,
            }
            enqueue = getattr(self._processing_queue, "enqueue", None)
            if enqueue is not None:
                await enqueue(job)

        return document 