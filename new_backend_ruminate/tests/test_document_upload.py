"""Test document upload functionality with Marker API integration"""
import pytest
import logging
import asyncio
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch
import json

from new_backend_ruminate.domain.document.entities import Document, DocumentStatus
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.infrastructure.document_processing.marker_client import MarkerClient
from new_backend_ruminate.infrastructure.object_storage.local_storage import LocalObjectStorage

# Configure logging for the test
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Also set specific loggers to DEBUG
logging.getLogger("new_backend_ruminate.infrastructure.document_processing").setLevel(logging.DEBUG)
logging.getLogger("new_backend_ruminate.services.document").setLevel(logging.DEBUG)


@pytest.mark.asyncio
async def test_document_upload_with_mock_marker(db_session, tmp_path):
    """Test document upload with mocked Marker API"""
    logger.info("Starting document upload test with mocked Marker API")
    
    # Setup
    event_hub = EventStreamHub()
    document_repository = RDSDocumentRepository()
    storage = LocalObjectStorage(str(tmp_path))
    
    # Mock Marker client
    mock_marker_client = AsyncMock(spec=MarkerClient)
    mock_marker_response = Mock()
    mock_marker_response.status = "completed"
    mock_marker_response.pages = [
        {
            "page_number": 0,  # 0-based page numbering
            "polygon": [[0, 0], [612, 0], [612, 792], [0, 792]],
            "html": "<p>Test page content</p>",
            "blocks": [
                {
                    "block_type": "Text",
                    "html": "<p>Test block content</p>",
                    "polygon": [[0, 0], [612, 100], [612, 200], [0, 100]]
                }
            ]
        }
    ]
    mock_marker_client.process_document.return_value = mock_marker_response
    
    # Create service
    upload_service = DocumentService(
        repo=document_repository,
        hub=event_hub,
        storage=storage,
        marker_client=mock_marker_client
    )
    
    # Read test PDF
    test_pdf_path = Path(__file__).parent / "test.pdf"
    logger.info(f"Reading test PDF from: {test_pdf_path}")
    
    with open(test_pdf_path, "rb") as pdf_file:
        # Create mock background tasks
        background_tasks = Mock()
        task_func = None
        task_args = None
        
        def capture_task(func, *args):
            nonlocal task_func, task_args
            task_func = func
            task_args = args
        
        background_tasks.add_task = capture_task
        
        # Upload document
        logger.info("Uploading document...")
        document = await upload_service.upload_document(
            background=background_tasks,
            file=pdf_file,
            filename="test.pdf",
            user_id="test_user"
        )
        
        # Verify immediate response
        assert document.id is not None
        assert document.title == "test.pdf"
        assert document.status == DocumentStatus.PENDING
        assert document.user_id == "test_user"
        logger.info(f"Document created with ID: {document.id}")
        
        # Verify storage
        assert await storage.file_exists(f"documents/{document.id}/test.pdf")
        logger.info("Document stored successfully")
        
        # Run background task manually
        assert task_func is not None
        logger.info("Running background processing task...")
        await task_func(*task_args)
        
        # Verify document was processed
        processed_doc = await document_repository.get_document(document.id, db_session)
        assert processed_doc.status == DocumentStatus.READY
        logger.info("Document processed successfully")
        
        # Verify pages and blocks were created
        pages = await document_repository.get_pages_by_document(document.id, db_session)
        assert len(pages) == 1
        assert pages[0].page_number == 0  # 0-based page numbering like old implementation
        logger.info(f"Created {len(pages)} pages")
        
        blocks = await document_repository.get_blocks_by_document(document.id, db_session)
        assert len(blocks) == 1
        assert blocks[0].block_type.value == "Text"
        logger.info(f"Created {len(blocks)} blocks")


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.timeout(120)  # 2 minutes timeout for real API
async def test_document_upload_with_real_marker(db_session, tmp_path):
    """
    Test document upload with real Marker API
    Mark as integration test - only run when MARKER_API_KEY is set
    """
    import os
    
    api_key = os.getenv("MARKER_API_KEY")
    if not api_key:
        pytest.skip("MARKER_API_KEY not set - skipping integration test")
    
    logger.info("Starting document upload test with REAL Marker API")
    logger.info(f"API Key present: {'Yes' if api_key else 'No'}")
    logger.info(f"API Key length: {len(api_key) if api_key else 0}")
    
    # Setup
    event_hub = EventStreamHub()
    document_repository = RDSDocumentRepository()
    storage = LocalObjectStorage(str(tmp_path))
    
    # Create service with real Marker client
    upload_service = DocumentService(
        repo=document_repository,
        hub=event_hub,
        storage=storage
        # marker_client will use default (real) implementation
    )
    
    # Read test PDF
    test_pdf_path = Path(__file__).parent / "test.pdf"
    logger.info(f"Reading test PDF from: {test_pdf_path}")
    
    with open(test_pdf_path, "rb") as pdf_file:
        # Track SSE events
        events_received = []
        
        async def track_events():
            stream_id = None
            try:
                # Wait a bit for document to be created
                await asyncio.sleep(0.1)
                
                # Find the document ID from events
                docs = await document_repository.get_documents_by_user("test_user", db_session)
                if docs:
                    stream_id = f"document_{docs[0].id}"
                    logger.info(f"Subscribing to SSE stream: {stream_id}")
                    
                    async for chunk in event_hub.register_consumer(stream_id):
                        logger.info(f"SSE Event received: {chunk}")
                        events_received.append(chunk)
                        
                        # Parse event to check for completion
                        if "processing_completed" in chunk or "processing_error" in chunk:
                            break
            except Exception as e:
                logger.error(f"Error tracking events: {e}")
        
        # Start event tracking
        event_task = asyncio.create_task(track_events())
        
        # Create mock background tasks that actually runs the task
        background_tasks = Mock()
        
        async def run_task_async(func, *args):
            logger.info("Starting background task in separate coroutine")
            await func(*args)
        
        def add_task_wrapper(func, *args):
            asyncio.create_task(run_task_async(func, *args))
        
        background_tasks.add_task = add_task_wrapper
        
        # Upload document
        logger.info("Uploading document to Marker API...")
        document = await upload_service.upload_document(
            background=background_tasks,
            file=pdf_file,
            filename="test.pdf",
            user_id="test_user"
        )
        
        logger.info(f"Document created with ID: {document.id}")
        
        # Wait for processing (with timeout)
        logger.info("Waiting for Marker API processing...")
        max_wait = 120  # 2 minutes
        check_interval = 2
        
        for i in range(0, max_wait, check_interval):
            await asyncio.sleep(check_interval)
            
            doc = await document_repository.get_document(document.id, db_session)
            logger.info(f"Document status after {i+check_interval}s: {doc.status.value}")
            
            if doc.status in [DocumentStatus.READY, DocumentStatus.ERROR]:
                break
            
            if doc.processing_error:
                logger.error(f"Processing error: {doc.processing_error}")
        
        # Cancel event tracking
        event_task.cancel()
        try:
            await event_task
        except asyncio.CancelledError:
            pass
        
        # Final verification
        final_doc = await document_repository.get_document(document.id, db_session)
        logger.info(f"Final document status: {final_doc.status.value}")
        
        if final_doc.status == DocumentStatus.ERROR:
            logger.error(f"Document processing failed: {final_doc.processing_error}")
            if "401" in str(final_doc.processing_error) or "unauthorized" in str(final_doc.processing_error).lower():
                pytest.fail("Marker API authentication failed - API key may be invalid")
            else:
                pytest.fail(f"Document processing failed: {final_doc.processing_error}")
        
        assert final_doc.status == DocumentStatus.READY
        
        # Check results
        pages = await document_repository.get_pages_by_document(document.id, db_session)
        logger.info(f"Extracted {len(pages)} pages")
        assert len(pages) > 0
        
        blocks = await document_repository.get_blocks_by_document(document.id, db_session)
        logger.info(f"Extracted {len(blocks)} blocks")
        assert len(blocks) > 0
        
        # Log some sample content
        if blocks:
            logger.info(f"Sample block type: {blocks[0].block_type}")
            if blocks[0].html_content:
                logger.info(f"Sample content: {blocks[0].html_content[:100]}...")


@pytest.mark.asyncio
async def test_document_upload_error_handling(db_session, tmp_path):
    """Test document upload error handling"""
    logger.info("Testing document upload error handling")
    
    # Setup
    event_hub = EventStreamHub()
    document_repository = RDSDocumentRepository()
    storage = LocalObjectStorage(str(tmp_path))
    
    # Mock Marker client that fails
    mock_marker_client = AsyncMock(spec=MarkerClient)
    mock_marker_response = Mock()
    mock_marker_response.status = "error"
    mock_marker_response.error = "Test error from Marker API"
    mock_marker_client.process_document.return_value = mock_marker_response
    
    # Create service
    upload_service = DocumentService(
        repo=document_repository,
        hub=event_hub,
        storage=storage,
        marker_client=mock_marker_client
    )
    
    # Read test PDF
    test_pdf_path = Path(__file__).parent / "test.pdf"
    
    with open(test_pdf_path, "rb") as pdf_file:
        # Create mock background tasks
        background_tasks = Mock()
        task_func = None
        task_args = None
        
        def capture_task(func, *args):
            nonlocal task_func, task_args
            task_func = func
            task_args = args
        
        background_tasks.add_task = capture_task
        
        # Upload document
        document = await upload_service.upload_document(
            background=background_tasks,
            file=pdf_file,
            filename="test.pdf",
            user_id="test_user"
        )
        
        # Run background task
        await task_func(*task_args)
        
        # Verify error was recorded
        error_doc = await document_repository.get_document(document.id, db_session)
        assert error_doc.status == DocumentStatus.ERROR
        assert error_doc.processing_error == "Test error from Marker API"
        logger.info(f"Error correctly recorded: {error_doc.processing_error}")