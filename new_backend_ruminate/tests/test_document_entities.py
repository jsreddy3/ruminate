"""Tests for document domain entities"""
import pytest
from datetime import datetime
from new_backend_ruminate.domain.document.entities import (
    Document, DocumentStatus, Page, Block, BlockType
)


class TestDocumentEntity:
    """Test Document entity"""
    
    def test_document_creation(self):
        """Test creating a document with required fields"""
        doc = Document(
            id="doc-123",
            user_id="user-456",
            status=DocumentStatus.PENDING,
            title="Test Document.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        assert doc.id == "doc-123"
        assert doc.user_id == "user-456"
        assert doc.status == DocumentStatus.PENDING
        assert doc.title == "Test Document.pdf"
        assert doc.summary is None
        assert doc.processing_error is None
    
    def test_document_status_transitions(self):
        """Test document status transition methods"""
        doc = Document(
            id="doc-123",
            status=DocumentStatus.PENDING,
            title="Test.pdf",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Test start_marker_processing
        doc.start_marker_processing()
        assert doc.status == DocumentStatus.PROCESSING_MARKER
        
        # Test set_ready
        doc.set_ready()
        assert doc.status == DocumentStatus.READY
        assert doc.processing_error is None
        
        # Test set_error
        doc.set_error("Test error message")
        assert doc.status == DocumentStatus.ERROR
        assert doc.processing_error == "Test error message"
    
    def test_document_to_dict(self):
        """Test document serialization"""
        now = datetime.now()
        doc = Document(
            id="doc-123",
            user_id="user-456",
            status=DocumentStatus.READY,
            title="Test.pdf",
            summary="Test summary",
            s3_pdf_path="s3://bucket/path",
            created_at=now,
            updated_at=now
        )
        
        doc_dict = doc.to_dict()
        assert doc_dict["id"] == "doc-123"
        assert doc_dict["user_id"] == "user-456"
        assert doc_dict["status"] == "READY"
        assert doc_dict["title"] == "Test.pdf"
        assert doc_dict["summary"] == "Test summary"
        assert doc_dict["s3_pdf_path"] == "s3://bucket/path"
    
    def test_document_from_dict(self):
        """Test document deserialization"""
        doc_dict = {
            "id": "doc-123",
            "user_id": "user-456",
            "status": "PROCESSING_MARKER",
            "title": "Test.pdf",
            "summary": "Test summary",
            "created_at": "2024-01-01T12:00:00",
            "updated_at": "2024-01-01T12:00:00"
        }
        
        doc = Document.from_dict(doc_dict)
        assert doc.id == "doc-123"
        assert doc.user_id == "user-456"
        assert doc.status == DocumentStatus.PROCESSING_MARKER
        assert doc.title == "Test.pdf"
        assert doc.summary == "Test summary"


class TestPageEntity:
    """Test Page entity"""
    
    def test_page_creation(self):
        """Test creating a page"""
        page = Page(
            id="page-123",
            document_id="doc-456",
            page_number=0,
            html_content="<p>Test content</p>",
            polygon=[[0, 0], [100, 0], [100, 200], [0, 200]],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        assert page.id == "page-123"
        assert page.document_id == "doc-456"
        assert page.page_number == 0
        assert page.html_content == "<p>Test content</p>"
        assert len(page.polygon) == 4
        assert page.block_ids == []
    
    def test_page_add_block(self):
        """Test adding blocks to a page"""
        page = Page(
            id="page-123",
            document_id="doc-456",
            page_number=0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        page.add_block("block-1")
        page.add_block("block-2")
        
        assert len(page.block_ids) == 2
        assert "block-1" in page.block_ids
        assert "block-2" in page.block_ids
    
    def test_page_to_dict(self):
        """Test page serialization"""
        now = datetime.now()
        page = Page(
            id="page-123",
            document_id="doc-456",
            page_number=1,
            html_content="<p>Test</p>",
            polygon=[[0, 0], [100, 100]],
            block_ids=["block-1", "block-2"],
            created_at=now,
            updated_at=now
        )
        
        page_dict = page.to_dict()
        assert page_dict["id"] == "page-123"
        assert page_dict["document_id"] == "doc-456"
        assert page_dict["page_number"] == 1
        assert page_dict["html_content"] == "<p>Test</p>"
        assert len(page_dict["polygon"]) == 2
        assert len(page_dict["block_ids"]) == 2


class TestBlockEntity:
    """Test Block entity"""
    
    def test_block_creation(self):
        """Test creating a block"""
        block = Block(
            id="block-123",
            document_id="doc-456",
            page_id="page-789",
            block_type=BlockType.TEXT,
            html_content="<p>Test block</p>",
            page_number=0,
            polygon=[[0, 0], [100, 50]],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        assert block.id == "block-123"
        assert block.document_id == "doc-456"
        assert block.page_id == "page-789"
        assert block.block_type == BlockType.TEXT
        assert block.html_content == "<p>Test block</p>"
        assert block.page_number == 0
        assert not block.is_critical
    
    def test_block_from_marker_block(self):
        """Test creating block from Marker API data"""
        marker_data = {
            "block_type": "SectionHeader",
            "html": "<h1>Document Title</h1>",
            "polygon": [[0, 0], [200, 0], [200, 50], [0, 50]],
            "section_hierarchy": {"level": 1},
            "metadata": {"confidence": 0.95},
            "images": ["image1.png"]
        }
        
        block = Block.from_marker_block(
            marker_block=marker_data,
            document_id="doc-123",
            page_id="page-456",
            page_number=0
        )
        
        assert block.document_id == "doc-123"
        assert block.page_id == "page-456"
        assert block.page_number == 0
        assert block.block_type == BlockType.SECTION_HEADER
        assert block.html_content == "<h1>Document Title</h1>"
        assert len(block.polygon) == 4
        assert block.section_hierarchy == {"level": 1}
        assert block.metadata == {"confidence": 0.95}
        assert block.images == ["image1.png"]
    
    def test_block_from_marker_block_minimal(self):
        """Test creating block from minimal Marker data"""
        marker_data = {
            "block_type": "Text",
            "html": "<p>Simple text</p>"
        }
        
        block = Block.from_marker_block(
            marker_block=marker_data,
            document_id="doc-123",
            page_id="page-456"
        )
        
        assert block.document_id == "doc-123"
        assert block.page_id == "page-456"
        assert block.block_type == BlockType.TEXT
        assert block.html_content == "<p>Simple text</p>"
        assert block.page_number is None
        assert block.polygon is None
    
    def test_block_to_dict(self):
        """Test block serialization"""
        now = datetime.now()
        block = Block(
            id="block-123",
            document_id="doc-456",
            page_id="page-789",
            block_type=BlockType.TABLE,
            html_content="<table>...</table>",
            page_number=2,
            is_critical=True,
            critical_summary="Important table",
            created_at=now,
            updated_at=now
        )
        
        block_dict = block.to_dict()
        assert block_dict["id"] == "block-123"
        assert block_dict["document_id"] == "doc-456"
        assert block_dict["page_id"] == "page-789"
        assert block_dict["block_type"] == "Table"
        assert block_dict["html_content"] == "<table>...</table>"
        assert block_dict["page_number"] == 2
        assert block_dict["is_critical"] is True
        assert block_dict["critical_summary"] == "Important table"
    
    def test_block_type_enum_values(self):
        """Test BlockType enum has expected values"""
        # Test some common block types
        assert BlockType.TEXT.value == "Text"
        assert BlockType.SECTION_HEADER.value == "SectionHeader"
        assert BlockType.TABLE.value == "Table"
        assert BlockType.LIST_ITEM.value == "ListItem"
        assert BlockType.CODE.value == "Code"
        assert BlockType.FIGURE.value == "Figure"
        
        # Test exact match required (case sensitive)
        assert BlockType("Text") == BlockType.TEXT
        assert BlockType("SectionHeader") == BlockType.SECTION_HEADER
        assert BlockType("Table") == BlockType.TABLE