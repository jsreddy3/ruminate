"""Tests for ChunkService and chunk management functionality"""
import pytest
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from uuid import uuid4

from new_backend_ruminate.services.chunk import ChunkService
from new_backend_ruminate.domain.document.entities.chunk import Chunk, ChunkStatus
from new_backend_ruminate.domain.document.entities import Document, DocumentStatus, Block, BlockType
from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
from new_backend_ruminate.domain.conversation.entities.message import Message, Role


@pytest.mark.asyncio
class TestChunkService:
    """Test ChunkService functionality"""
    
    async def test_create_chunks_for_small_document(self, db_session):
        """Test creating chunks for a document with less than 20 pages"""
        repo = RDSDocumentRepository()
        chunk_service = ChunkService(repo=repo, llm=None)
        
        # Create a test document
        doc = Document(
            id="test-doc-1",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="Small Document.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create chunks for a 15-page document
        chunks = await chunk_service.create_chunks_for_document(
            document_id="test-doc-1",
            total_pages=15,
            session=db_session
        )
        
        # Should create 1 chunk (0-15)
        assert len(chunks) == 1
        assert chunks[0].chunk_index == 0
        assert chunks[0].start_page == 0
        assert chunks[0].end_page == 15
        assert chunks[0].status == ChunkStatus.UNPROCESSED
        assert chunks[0].document_id == "test-doc-1"
    
    async def test_create_chunks_for_large_document(self, db_session):
        """Test creating chunks for a document with multiple 20-page windows"""
        repo = RDSDocumentRepository()
        chunk_service = ChunkService(repo=repo, llm=None)
        
        # Create a test document
        doc = Document(
            id="test-doc-2",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="Large Document.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create chunks for a 65-page document
        chunks = await chunk_service.create_chunks_for_document(
            document_id="test-doc-2",
            total_pages=65,
            session=db_session
        )
        
        # Should create 4 chunks: 0-20, 20-40, 40-60, 60-65
        assert len(chunks) == 4
        
        # Check first chunk
        assert chunks[0].chunk_index == 0
        assert chunks[0].start_page == 0
        assert chunks[0].end_page == 20
        
        # Check second chunk
        assert chunks[1].chunk_index == 1
        assert chunks[1].start_page == 20
        assert chunks[1].end_page == 40
        
        # Check third chunk
        assert chunks[2].chunk_index == 2
        assert chunks[2].start_page == 40
        assert chunks[2].end_page == 60
        
        # Check last chunk (partial)
        assert chunks[3].chunk_index == 3
        assert chunks[3].start_page == 60
        assert chunks[3].end_page == 65
        
        # All should be unprocessed
        for chunk in chunks:
            assert chunk.status == ChunkStatus.UNPROCESSED
            assert chunk.document_id == "test-doc-2"
    
    async def test_assign_blocks_to_chunks(self, db_session):
        """Test assigning blocks to their corresponding chunks"""
        repo = RDSDocumentRepository()
        chunk_service = ChunkService(repo=repo, llm=None)
        
        # Create a test document
        doc = Document(
            id="test-doc-3",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="Test Document.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create chunks
        chunks = await chunk_service.create_chunks_for_document(
            document_id="test-doc-3",
            total_pages=45,  # Will create 3 chunks
            session=db_session
        )
        
        # Create blocks across different pages
        blocks = [
            Block(
                id=f"block-{i}",
                document_id="test-doc-3",
                page_number=page_num,
                block_type=BlockType.TEXT,
                html_content=f"<p>Block on page {page_num}</p>",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            for i, page_num in enumerate([5, 15, 25, 35, 42])
        ]
        await repo.create_blocks(blocks, db_session)
        
        # Assign blocks to chunks
        await chunk_service.assign_blocks_to_chunks(
            document_id="test-doc-3",
            session=db_session
        )
        
        # Verify assignments
        updated_blocks = await repo.get_blocks_by_document("test-doc-3", db_session)
        
        # Sort blocks by page number for consistent testing
        updated_blocks.sort(key=lambda b: b.page_number)
        
        # Page 5 and 15 should be in chunk 0 (0-20)
        assert updated_blocks[0].page_number == 5
        assert updated_blocks[0].chunk_id == chunks[0].id
        assert updated_blocks[1].page_number == 15
        assert updated_blocks[1].chunk_id == chunks[0].id
        
        # Page 25 and 35 should be in chunk 1 (20-40)
        assert updated_blocks[2].page_number == 25
        assert updated_blocks[2].chunk_id == chunks[1].id
        assert updated_blocks[3].page_number == 35
        assert updated_blocks[3].chunk_id == chunks[1].id
        
        # Page 42 should be in chunk 2 (40-45)
        assert updated_blocks[4].page_number == 42
        assert updated_blocks[4].chunk_id == chunks[2].id
    
    async def test_get_chunk_for_page(self, db_session):
        """Test finding the correct chunk for a given page number"""
        repo = RDSDocumentRepository()
        chunk_service = ChunkService(repo=repo, llm=None)
        
        # Create document and chunks
        doc = Document(
            id="test-doc-4",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="Test Document.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        chunks = await chunk_service.create_chunks_for_document(
            document_id="test-doc-4",
            total_pages=50,
            session=db_session
        )
        
        # Test page lookups
        chunk = await chunk_service.get_chunk_for_page("test-doc-4", 5, db_session)
        assert chunk.chunk_index == 0  # Page 5 is in first chunk (0-20)
        
        chunk = await chunk_service.get_chunk_for_page("test-doc-4", 25, db_session)
        assert chunk.chunk_index == 1  # Page 25 is in second chunk (20-40)
        
        chunk = await chunk_service.get_chunk_for_page("test-doc-4", 45, db_session)
        assert chunk.chunk_index == 2  # Page 45 is in third chunk (40-50)
        
        # Test edge cases
        chunk = await chunk_service.get_chunk_for_page("test-doc-4", 0, db_session)
        assert chunk.chunk_index == 0  # First page
        
        chunk = await chunk_service.get_chunk_for_page("test-doc-4", 19, db_session)
        assert chunk.chunk_index == 0  # Last page of first chunk
        
        chunk = await chunk_service.get_chunk_for_page("test-doc-4", 20, db_session)
        assert chunk.chunk_index == 1  # First page of second chunk
    
    async def test_chunk_summary_generation(self, db_session):
        """Test generating summaries for chunks"""
        repo = RDSDocumentRepository()
        
        # Mock LLM service
        mock_llm = AsyncMock()
        mock_llm.generate_response = AsyncMock(return_value="This is a summary of pages 0-19 covering introduction and methodology.")
        
        chunk_service = ChunkService(repo=repo, llm=mock_llm)
        
        # Create document with document_info
        doc = Document(
            id="test-doc-5",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="Research Paper.pdf",
            document_info="A research paper on machine learning techniques",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create chunks
        chunks = await chunk_service.create_chunks_for_document(
            document_id="test-doc-5",
            total_pages=40,
            session=db_session
        )
        
        # Create some blocks with content (don't set chunk_id, let the service handle that)
        blocks = [
            Block(
                id=f"block-5-{i}-{uuid4()}",  # Unique ID
                document_id="test-doc-5",
                page_number=i,
                block_type=BlockType.TEXT,
                html_content=f"<p>Content for page {i}</p>",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            for i in range(25)  # Create blocks for pages 0-24
        ]
        await repo.create_blocks(blocks, db_session)
        
        # Generate summaries for chunks up to page 25
        chunk_summaries = await chunk_service.get_or_generate_chunk_summaries(
            document_id="test-doc-5",
            up_to_page=25,
            session=db_session
        )
        
        # Should have 2 chunks with summaries
        assert len(chunk_summaries) == 2
        
        # Check that LLM was called
        assert mock_llm.generate_response.call_count == 2
        
        # Verify chunks were updated with summaries
        updated_chunks = await repo.get_chunks_by_document("test-doc-5", db_session)
        assert updated_chunks[0].status == ChunkStatus.READY
        assert updated_chunks[0].summary == "This is a summary of pages 0-19 covering introduction and methodology."
        assert updated_chunks[1].status == ChunkStatus.READY
        assert updated_chunks[1].summary == "This is a summary of pages 0-19 covering introduction and methodology."
    
    async def test_lazy_chunk_summary_generation(self, db_session):
        """Test that summaries are only generated when needed"""
        repo = RDSDocumentRepository()
        
        # Mock LLM service
        mock_llm = AsyncMock()
        mock_llm.generate_response = AsyncMock(return_value="Generated summary")
        
        chunk_service = ChunkService(repo=repo, llm=mock_llm)
        
        # Create document
        doc = Document(
            id="test-doc-6",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="Test.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create chunks
        chunks = await chunk_service.create_chunks_for_document(
            document_id="test-doc-6",
            total_pages=60,  # 3 chunks
            session=db_session
        )
        
        # Manually set first chunk as already processed
        chunks[0].set_ready("Pre-existing summary")
        await repo.update_chunk(chunks[0], db_session)
        
        # Create minimal blocks
        blocks = [
            Block(
                id=f"block-6-{i}-{uuid4()}",  # Unique ID
                document_id="test-doc-6",
                page_number=i*10,
                block_type=BlockType.TEXT,
                html_content=f"<p>Page {i*10}</p>",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            for i in range(4)  # Pages 0, 10, 20, 30
        ]
        await repo.create_blocks(blocks, db_session)
        
        # Request summaries up to page 35
        chunk_summaries = await chunk_service.get_or_generate_chunk_summaries(
            document_id="test-doc-6",
            up_to_page=35,
            session=db_session
        )
        
        # Should return 2 chunks (0-20, 20-40)
        assert len(chunk_summaries) == 2
        
        # First chunk should use existing summary
        assert chunk_summaries[0][1] == "Pre-existing summary"
        
        # Second chunk should be newly generated
        assert chunk_summaries[1][1] == "Generated summary"
        
        # LLM should only be called once (for the second chunk)
        assert mock_llm.generate_response.call_count == 1
    
    async def test_chunk_summary_error_handling(self, db_session):
        """Test error handling during chunk summary generation"""
        repo = RDSDocumentRepository()
        
        # Mock LLM service that raises an error
        mock_llm = AsyncMock()
        mock_llm.generate_response = AsyncMock(side_effect=Exception("LLM API error"))
        
        chunk_service = ChunkService(repo=repo, llm=mock_llm)
        
        # Create document
        doc = Document(
            id="test-doc-7",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="Test.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create chunks
        chunks = await chunk_service.create_chunks_for_document(
            document_id="test-doc-7",
            total_pages=20,
            session=db_session
        )
        
        # Create blocks
        blocks = [
            Block(
                id=f"block-error-{uuid4()}",  # Use unique ID
                document_id="test-doc-7",
                page_number=5,
                block_type=BlockType.TEXT,
                html_content="<p>Content</p>",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        ]
        await repo.create_blocks(blocks, db_session)
        
        # Try to generate summaries - should handle error gracefully
        chunk_summaries = await chunk_service.get_or_generate_chunk_summaries(
            document_id="test-doc-7",
            up_to_page=10,
            session=db_session
        )
        
        # Should still return the chunk, but with error status
        assert len(chunk_summaries) == 1
        
        # Check chunk was marked as errored
        updated_chunk = await repo.get_chunk(chunks[0].id, db_session)
        assert updated_chunk.status == ChunkStatus.ERROR
        assert "LLM API error" in updated_chunk.processing_error
        assert updated_chunk.summary is None or updated_chunk.summary == ""
    
    async def test_extract_text_from_blocks(self):
        """Test text extraction from HTML blocks"""
        chunk_service = ChunkService(repo=Mock(), llm=None)
        
        blocks = [
            Block(
                id="1",
                document_id="doc",
                html_content="<p>First paragraph</p>",
                page_number=0
            ),
            Block(
                id="2",
                document_id="doc",
                html_content="<h1>Title</h1><p>Second <strong>paragraph</strong></p>",
                page_number=0
            ),
            Block(
                id="3",
                document_id="doc",
                html_content=None,  # Test null content
                page_number=1
            ),
            Block(
                id="4",
                document_id="doc",
                html_content="<div>Last content</div>",
                page_number=1
            )
        ]
        
        text = chunk_service._extract_text_from_blocks(blocks)
        
        # Should clean HTML and join with double newlines
        expected = "First paragraph\n\nTitle Second paragraph\n\nLast content"
        assert text == expected
    
    async def test_chunk_contains_page(self):
        """Test chunk page containment check"""
        chunk = Chunk(
            id="chunk-1",
            document_id="doc-1",
            chunk_index=1,
            start_page=20,
            end_page=40
        )
        
        # Test pages that should be contained
        assert chunk.contains_page(20) is True  # Start boundary
        assert chunk.contains_page(30) is True  # Middle
        assert chunk.contains_page(39) is True  # End boundary - 1
        
        # Test pages that should NOT be contained
        assert chunk.contains_page(19) is False  # Before start
        assert chunk.contains_page(40) is False  # End boundary (exclusive)
        assert chunk.contains_page(50) is False  # After end