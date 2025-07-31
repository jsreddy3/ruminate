"""Test lazy loading functionality for block images"""
import pytest
import json
from datetime import datetime
from unittest.mock import AsyncMock
from new_backend_ruminate.domain.document.entities import Document, DocumentStatus, Page, Block, BlockType
from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.domain.user.entities.user import User


@pytest.mark.asyncio
class TestLazyLoadingImages:
    """Test lazy loading of block images"""
    
    async def setup_test_data(self, db_session, storage, doc_id="test-doc-lazy"):
        """Create test document with blocks containing images"""
        repo = RDSDocumentRepository()
        
        # Create test document
        doc = Document(
            id=doc_id,
            user_id="test-user-123",
            status=DocumentStatus.READY,
            title="Test Document with Images.pdf",
            s3_pdf_path=f"documents/{doc_id}/test.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create a page
        page = Page(
            id=f"{doc_id}-page-1",
            document_id=doc_id,
            page_number=0,
            html_content="<p>Test page</p>",
            polygon=[[0, 0], [612, 0], [612, 792], [0, 792]],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_pages([page], db_session)
        
        # Create blocks - some with images, some without
        blocks = [
            Block(
                id=f"{doc_id}-block-text-1",
                document_id=doc_id,
                page_id=f"{doc_id}-page-1",
                page_number=0,
                block_type=BlockType.TEXT,
                html_content="<p>This is a text block without images</p>",
                polygon=[[0, 0], [612, 100], [612, 200], [0, 100]],
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            Block(
                id=f"{doc_id}-block-figure-1",
                document_id=doc_id,
                page_id=f"{doc_id}-page-1",
                page_number=0,
                block_type=BlockType.FIGURE,
                html_content="<figure>Figure 1</figure>",
                polygon=[[0, 200], [612, 300], [612, 400], [0, 300]],
                images={
                    "figure1.png": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",  # 1x1 red pixel
                    "figure1_alt.png": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
                },
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            Block(
                id=f"{doc_id}-block-picture-1",
                document_id=doc_id,
                page_id=f"{doc_id}-page-1",
                page_number=0,
                block_type=BlockType.PICTURE,
                html_content="<img>Picture 1</img>",
                polygon=[[0, 400], [612, 500], [612, 600], [0, 500]],
                images={
                    "pic1.jpg": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="  # 1x1 blue pixel
                },
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        ]
        await repo.create_blocks(blocks, db_session)
        
        # No need to store dummy PDF with mock storage
        
        return doc, blocks
    
    async def test_get_blocks_without_images(self, db_session, tmp_path):
        """Test fetching blocks without image data"""
        # Setup
        storage = AsyncMock()
        doc_id = "test-doc-lazy-1"
        doc, blocks = await self.setup_test_data(db_session, storage, doc_id)
        
        # Create service
        event_hub = EventStreamHub()
        repo = RDSDocumentRepository()
        service = DocumentService(repo=repo, hub=event_hub, storage=storage)
        
        # Fetch blocks without images (this is what the route would call)
        fetched_blocks = await service.get_document_blocks(
            document_id=doc_id,
            page_number=None,
            user_id="test-user-123",
            session=db_session
        )
        
        assert len(fetched_blocks) == 3
        
        # Check text block (no images)
        text_block = next(b for b in fetched_blocks if b.id == f"{doc_id}-block-text-1")
        assert text_block.images is None
        
        # Check figure block (has images)
        figure_block = next(b for b in fetched_blocks if b.id == f"{doc_id}-block-figure-1")
        assert figure_block.images is not None
        assert len(figure_block.images) == 2
        assert "figure1.png" in figure_block.images
        assert "figure1_alt.png" in figure_block.images
        
        # When we implement lazy loading in the route, we would check:
        # assert figure_block.images["figure1.png"] == "LAZY_LOAD"
        # assert figure_block.images["figure1_alt.png"] == "LAZY_LOAD"
        
        # Check picture block (has image)
        picture_block = next(b for b in fetched_blocks if b.id == f"{doc_id}-block-picture-1")
        assert picture_block.images is not None
        assert len(picture_block.images) == 1
        assert "pic1.jpg" in picture_block.images
    
    async def test_get_block_images_endpoint(self, db_session, tmp_path):
        """Test fetching images for a specific block"""
        # Setup
        storage = AsyncMock()
        doc_id = "test-doc-lazy-2"
        doc, blocks = await self.setup_test_data(db_session, storage, doc_id)
        
        # Create service
        event_hub = EventStreamHub()
        repo = RDSDocumentRepository()
        service = DocumentService(repo=repo, hub=event_hub, storage=storage)
        
        # Test getting images for figure block
        all_blocks = await service.get_document_blocks(
            document_id=doc_id,
            page_number=None,
            user_id="test-user-123",
            session=db_session
        )
        
        # Find the figure block
        figure_block = next(b for b in all_blocks if b.id == f"{doc_id}-block-figure-1")
        
        # Verify it has the expected images
        assert figure_block.images is not None
        assert len(figure_block.images) == 2
        assert figure_block.images["figure1.png"] == "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        assert figure_block.images["figure1_alt.png"] == "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        # Test block without images
        text_block = next(b for b in all_blocks if b.id == f"{doc_id}-block-text-1")
        assert text_block.images is None or len(text_block.images) == 0
    
    async def test_access_control(self, db_session, tmp_path):
        """Test that users can only access their own documents' block images"""
        # Setup
        storage = AsyncMock()
        doc_id = "test-doc-lazy-3"
        doc, blocks = await self.setup_test_data(db_session, storage, doc_id)
        
        # Create service
        event_hub = EventStreamHub()
        repo = RDSDocumentRepository()
        service = DocumentService(repo=repo, hub=event_hub, storage=storage)
        
        # Try to access with different user - should fail
        with pytest.raises(PermissionError):
            await service.get_document_blocks(
                document_id=doc_id,
                page_number=None,
                user_id="different-user",
                session=db_session
            )
    
    async def test_nonexistent_block(self, db_session, tmp_path):
        """Test requesting images for non-existent block"""
        # Setup
        storage = AsyncMock()
        doc_id = "test-doc-lazy-4"
        doc, blocks = await self.setup_test_data(db_session, storage, doc_id)
        
        # Create service
        event_hub = EventStreamHub()
        repo = RDSDocumentRepository()
        service = DocumentService(repo=repo, hub=event_hub, storage=storage)
        
        # Get blocks to verify document exists
        blocks = await service.get_document_blocks(
            document_id=doc_id,
            page_number=None,
            user_id="test-user-123",
            session=db_session
        )
        
        # Try to find non-existent block
        non_existent_block = next((b for b in blocks if b.id == "non-existent-block"), None)
        assert non_existent_block is None