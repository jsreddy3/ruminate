"""Tests for document repository implementation"""
import pytest
from datetime import datetime
from sqlalchemy import select
from new_backend_ruminate.domain.document.entities import Document, DocumentStatus, Page, Block, BlockType
from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
from new_backend_ruminate.infrastructure.document.models import DocumentModel, PageModel, BlockModel


@pytest.mark.asyncio
class TestDocumentRepository:
    """Test RDSDocumentRepository"""
    
    async def test_create_document(self, db_session):
        """Test creating a document"""
        repo = RDSDocumentRepository()
        
        # Create document
        doc = Document(
            id="test-doc-1",
            user_id="user-123",
            status=DocumentStatus.PENDING,
            title="Test Document.pdf",
            s3_pdf_path="s3://bucket/test.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        created_doc = await repo.create_document(doc, db_session)
        
        # Verify returned document
        assert created_doc.id == "test-doc-1"
        assert created_doc.user_id == "user-123"
        assert created_doc.status == DocumentStatus.PENDING
        assert created_doc.title == "Test Document.pdf"
        
        # Verify in database
        result = await db_session.execute(
            select(DocumentModel).where(DocumentModel.id == "test-doc-1")
        )
        db_doc = result.scalar_one_or_none()
        assert db_doc is not None
        assert db_doc.title == "Test Document.pdf"
    
    async def test_get_document(self, db_session):
        """Test getting a document by ID"""
        repo = RDSDocumentRepository()
        
        # Create document first
        doc = Document(
            id="test-doc-2",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="Test Get.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Get document
        retrieved_doc = await repo.get_document("test-doc-2", db_session)
        
        assert retrieved_doc is not None
        assert retrieved_doc.id == "test-doc-2"
        assert retrieved_doc.title == "Test Get.pdf"
        assert retrieved_doc.status == DocumentStatus.READY
        
        # Test non-existent document
        non_existent = await repo.get_document("non-existent", db_session)
        assert non_existent is None
    
    async def test_get_documents_by_user(self, db_session):
        """Test getting all documents for a user"""
        repo = RDSDocumentRepository()
        
        # Create multiple documents for different users
        docs = [
            Document(
                id=f"doc-user1-{i}",
                user_id="user-1",
                status=DocumentStatus.READY,
                title=f"User 1 Doc {i}.pdf",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            for i in range(3)
        ]
        
        docs.extend([
            Document(
                id=f"doc-user2-{i}",
                user_id="user-2",
                status=DocumentStatus.READY,
                title=f"User 2 Doc {i}.pdf",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            for i in range(2)
        ])
        
        for doc in docs:
            await repo.create_document(doc, db_session)
        
        # Get documents for user-1
        user1_docs = await repo.get_documents_by_user("user-1", db_session)
        assert len(user1_docs) == 3
        assert all(doc.user_id == "user-1" for doc in user1_docs)
        
        # Get documents for user-2
        user2_docs = await repo.get_documents_by_user("user-2", db_session)
        assert len(user2_docs) == 2
        assert all(doc.user_id == "user-2" for doc in user2_docs)
        
        # Get documents for non-existent user
        no_docs = await repo.get_documents_by_user("user-999", db_session)
        assert len(no_docs) == 0
    
    async def test_update_document(self, db_session):
        """Test updating a document"""
        repo = RDSDocumentRepository()
        
        # Create document
        doc = Document(
            id="test-update",
            user_id="user-123",
            status=DocumentStatus.PENDING,
            title="Original Title.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Update document
        doc.status = DocumentStatus.READY
        doc.title = "Updated Title.pdf"
        doc.summary = "Document summary"
        doc.processing_error = None
        
        updated_doc = await repo.update_document(doc, db_session)
        
        assert updated_doc.status == DocumentStatus.READY
        assert updated_doc.title == "Updated Title.pdf"
        assert updated_doc.summary == "Document summary"
        
        # Verify in database
        retrieved = await repo.get_document("test-update", db_session)
        assert retrieved.status == DocumentStatus.READY
        assert retrieved.title == "Updated Title.pdf"
    
    async def test_delete_document(self, db_session):
        """Test deleting a document"""
        repo = RDSDocumentRepository()
        
        # Create document
        doc = Document(
            id="test-delete",
            user_id="user-123",
            status=DocumentStatus.READY,
            title="To Delete.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Verify it exists
        exists = await repo.get_document("test-delete", db_session)
        assert exists is not None
        
        # Delete document
        deleted = await repo.delete_document("test-delete", db_session)
        assert deleted is True
        
        # Verify it's gone
        gone = await repo.get_document("test-delete", db_session)
        assert gone is None
        
        # Try deleting non-existent document
        not_deleted = await repo.delete_document("non-existent", db_session)
        assert not_deleted is False


@pytest.mark.asyncio
class TestPageRepository:
    """Test page-related repository methods"""
    
    async def test_create_pages(self, db_session):
        """Test creating multiple pages"""
        repo = RDSDocumentRepository()
        
        # Create document first
        doc = Document(
            id="doc-with-pages",
            status=DocumentStatus.READY,
            title="Doc with pages.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create pages
        pages = [
            Page(
                id=f"page-{i}",
                document_id="doc-with-pages",
                page_number=i,
                html_content=f"<p>Page {i} content</p>",
                polygon=[[0, 0], [100, 100]],
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            for i in range(3)
        ]
        
        created_pages = await repo.create_pages(pages, db_session)
        
        assert len(created_pages) == 3
        for i, page in enumerate(created_pages):
            assert page.page_number == i
            assert page.document_id == "doc-with-pages"
    
    async def test_get_pages_by_document(self, db_session):
        """Test getting pages for a document"""
        repo = RDSDocumentRepository()
        
        # Create document
        doc = Document(
            id="doc-get-pages",
            status=DocumentStatus.READY,
            title="Doc.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create pages
        pages = [
            Page(
                id=f"gp-{i}",
                document_id="doc-get-pages",
                page_number=i,
                html_content=f"<p>Content {i}</p>",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            for i in range(5)
        ]
        await repo.create_pages(pages, db_session)
        
        # Get pages
        retrieved_pages = await repo.get_pages_by_document("doc-get-pages", db_session)
        
        assert len(retrieved_pages) == 5
        # Should be ordered by page number
        for i, page in enumerate(retrieved_pages):
            assert page.page_number == i
    
    async def test_get_page(self, db_session):
        """Test getting a specific page"""
        repo = RDSDocumentRepository()
        
        # Create document and page
        doc = Document(
            id="doc-single-page",
            status=DocumentStatus.READY,
            title="Doc.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        page = Page(
            id="single-page-123",
            document_id="doc-single-page",
            page_number=0,
            html_content="<p>Single page</p>",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_pages([page], db_session)
        
        # Get page
        retrieved = await repo.get_page("single-page-123", db_session)
        assert retrieved is not None
        assert retrieved.id == "single-page-123"
        assert retrieved.html_content == "<p>Single page</p>"
        
        # Non-existent page
        none_page = await repo.get_page("non-existent", db_session)
        assert none_page is None


@pytest.mark.asyncio
class TestBlockRepository:
    """Test block-related repository methods"""
    
    async def test_create_blocks(self, db_session):
        """Test creating multiple blocks"""
        repo = RDSDocumentRepository()
        
        # Create document and page
        doc = Document(
            id="doc-with-blocks",
            status=DocumentStatus.READY,
            title="Doc.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        page = Page(
            id="page-for-blocks",
            document_id="doc-with-blocks",
            page_number=0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_pages([page], db_session)
        
        # Create blocks
        blocks = [
            Block(
                id=f"block-{i}",
                document_id="doc-with-blocks",
                page_id="page-for-blocks",
                page_number=0,
                block_type=BlockType.TEXT,
                html_content=f"<p>Block {i}</p>",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            for i in range(3)
        ]
        
        created_blocks = await repo.create_blocks(blocks, db_session)
        
        assert len(created_blocks) == 3
        for block in created_blocks:
            assert block.document_id == "doc-with-blocks"
            assert block.page_id == "page-for-blocks"
    
    async def test_get_blocks_by_document(self, db_session):
        """Test getting blocks for a document"""
        repo = RDSDocumentRepository()
        
        # Create document
        doc = Document(
            id="doc-get-blocks",
            status=DocumentStatus.READY,
            title="Doc.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create blocks across multiple pages
        blocks = []
        for page_num in range(2):
            page = Page(
                id=f"page-gb-{page_num}",
                document_id="doc-get-blocks",
                page_number=page_num,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            await repo.create_pages([page], db_session)
            
            for i in range(3):
                blocks.append(Block(
                    id=f"block-p{page_num}-{i}",
                    document_id="doc-get-blocks",
                    page_id=f"page-gb-{page_num}",
                    page_number=page_num,
                    block_type=BlockType.TEXT,
                    html_content=f"<p>Page {page_num} Block {i}</p>",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                ))
        
        await repo.create_blocks(blocks, db_session)
        
        # Get all blocks for document
        retrieved_blocks = await repo.get_blocks_by_document("doc-get-blocks", db_session)
        
        assert len(retrieved_blocks) == 6  # 2 pages × 3 blocks
        # Should be ordered by page number, then block id
        assert retrieved_blocks[0].page_number == 0
        assert retrieved_blocks[-1].page_number == 1
    
    async def test_get_blocks_by_page(self, db_session):
        """Test getting blocks for a specific page"""
        repo = RDSDocumentRepository()
        
        # Setup document and pages
        doc = Document(
            id="doc-page-blocks",
            status=DocumentStatus.READY,
            title="Doc.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        pages = []
        for i in range(2):
            pages.append(Page(
                id=f"page-pb-{i}",
                document_id="doc-page-blocks",
                page_number=i,
                created_at=datetime.now(),
                updated_at=datetime.now()
            ))
        await repo.create_pages(pages, db_session)
        
        # Create blocks for each page
        blocks = []
        for page_idx, page in enumerate(pages):
            for i in range(2):
                blocks.append(Block(
                    id=f"block-pb-p{page_idx}-{i}",
                    document_id="doc-page-blocks",
                    page_id=page.id,
                    page_number=page_idx,
                    block_type=BlockType.TEXT,
                    html_content=f"<p>Page {page_idx} Block {i}</p>",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                ))
        await repo.create_blocks(blocks, db_session)
        
        # Get blocks for first page
        page1_blocks = await repo.get_blocks_by_page("page-pb-0", db_session)
        assert len(page1_blocks) == 2
        assert all(b.page_id == "page-pb-0" for b in page1_blocks)
        
        # Get blocks for second page
        page2_blocks = await repo.get_blocks_by_page("page-pb-1", db_session)
        assert len(page2_blocks) == 2
        assert all(b.page_id == "page-pb-1" for b in page2_blocks)
    
    async def test_update_block(self, db_session):
        """Test updating a block (critical content)"""
        repo = RDSDocumentRepository()
        
        # Setup
        doc = Document(
            id="doc-update-block",
            status=DocumentStatus.READY,
            title="Doc.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        block = Block(
            id="block-to-update",
            document_id="doc-update-block",
            block_type=BlockType.TEXT,
            html_content="<p>Important text</p>",
            is_critical=False,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_blocks([block], db_session)
        
        # Update block to mark as critical
        block.is_critical = True
        block.critical_summary = "This is a critical finding"
        
        updated_block = await repo.update_block(block, db_session)
        
        assert updated_block.is_critical is True
        assert updated_block.critical_summary == "This is a critical finding"
        
        # Verify in database
        retrieved = await repo.get_block("block-to-update", db_session)
        assert retrieved.is_critical is True
        assert retrieved.critical_summary == "This is a critical finding"
    
    async def test_get_critical_blocks(self, db_session):
        """Test getting critical blocks for a document"""
        repo = RDSDocumentRepository()
        
        # Setup document
        doc = Document(
            id="doc-critical",
            status=DocumentStatus.READY,
            title="Critical Doc.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        await repo.create_document(doc, db_session)
        
        # Create mix of critical and non-critical blocks
        blocks = []
        for i in range(5):
            blocks.append(Block(
                id=f"block-crit-{i}",
                document_id="doc-critical",
                page_number=0,
                block_type=BlockType.TEXT,
                html_content=f"<p>Block {i}</p>",
                is_critical=(i % 2 == 0),  # Even indices are critical
                critical_summary=f"Critical finding {i}" if i % 2 == 0 else None,
                created_at=datetime.now(),
                updated_at=datetime.now()
            ))
        await repo.create_blocks(blocks, db_session)
        
        # Get critical blocks
        critical_blocks = await repo.get_critical_blocks("doc-critical", db_session)
        
        assert len(critical_blocks) == 3  # blocks 0, 2, 4
        assert all(b.is_critical for b in critical_blocks)
        assert all(b.critical_summary is not None for b in critical_blocks)