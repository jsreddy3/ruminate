# tests/test_document_summary.py
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.document.entities import Document, DocumentStatus, Block
from new_backend_ruminate.infrastructure.document_processing.llm_document_analyzer import LLMDocumentAnalyzer
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub


class MockLLM:
    """Mock LLM that returns a predefined summary"""
    async def generate_response(self, messages):
        # Return a mock summary based on the content
        return "This document discusses machine learning algorithms and their applications in various fields. It covers supervised and unsupervised learning techniques, neural networks, and practical use cases in industry."


@pytest.mark.asyncio
async def test_document_analyzer_generates_summary():
    """Test that the LLMDocumentAnalyzer properly generates summaries"""
    # Create test blocks
    blocks = [
        Block(
            id="block1",
            document_id="doc1",
            html_content="<p>Machine learning is a subset of artificial intelligence.</p>",
            block_type="paragraph"
        ),
        Block(
            id="block2", 
            document_id="doc1",
            html_content="<p>Neural networks are inspired by biological neurons.</p>",
            block_type="paragraph"
        )
    ]
    
    # Create analyzer with mock LLM
    mock_llm = MockLLM()
    analyzer = LLMDocumentAnalyzer(mock_llm)
    
    # Generate summary
    summary = await analyzer.generate_document_summary(blocks, "AI Research Paper")
    
    # Verify summary was generated
    assert summary is not None
    assert "machine learning" in summary.lower()
    assert len(summary) > 50  # Should be a reasonable length


@pytest.mark.asyncio 
async def test_document_service_generates_summary_during_processing(db_session):
    """Test that DocumentService generates summaries during document processing"""
    # Create mock components
    mock_repo = AsyncMock()
    mock_hub = EventStreamHub()
    mock_storage = AsyncMock()
    mock_analyzer = AsyncMock()
    
    # Setup mock returns
    test_document = Document(
        id="doc1",
        title="Test Document",
        status=DocumentStatus.PROCESSING_MARKER
    )
    
    test_blocks = [
        Block(
            id="block1",
            document_id="doc1", 
            html_content="<p>Test content about AI.</p>",
            block_type="paragraph"
        )
    ]
    
    mock_repo.get_document.return_value = test_document
    mock_repo.get_blocks_by_document.return_value = test_blocks
    mock_analyzer.generate_document_summary.return_value = "Test summary of the document."
    
    # Create service
    service = DocumentService(
        repo=mock_repo,
        hub=mock_hub,
        storage=mock_storage,
        analyzer=mock_analyzer
    )
    
    # Generate summary
    await service._generate_document_summary("doc1", db_session)
    
    # Verify analyzer was called
    mock_analyzer.generate_document_summary.assert_called_once_with(
        test_blocks,
        "Test Document"
    )
    
    # Verify document was updated with summary
    assert test_document.summary == "Test summary of the document."
    mock_repo.update_document.assert_called_once_with(test_document, db_session)


@pytest.mark.asyncio
async def test_summary_generation_handles_empty_blocks():
    """Test that analyzer handles documents with no blocks gracefully"""
    mock_llm = MockLLM()
    analyzer = LLMDocumentAnalyzer(mock_llm)
    
    # Generate summary with empty blocks
    summary = await analyzer.generate_document_summary([], "Empty Document")
    
    # Should return a default message
    assert "Summary not available" in summary


@pytest.mark.asyncio
async def test_summary_generation_strips_html():
    """Test that HTML is properly stripped from block content"""
    blocks = [
        Block(
            id="block1",
            document_id="doc1",
            html_content="<h1>Title</h1><p>This is <strong>important</strong> text with <a href='#'>links</a>.</p>",
            block_type="paragraph"
        )
    ]
    
    mock_llm = MockLLM()
    analyzer = LLMDocumentAnalyzer(mock_llm)
    
    # Test HTML stripping
    content = analyzer._prepare_document_content(blocks)
    
    # Verify HTML tags are removed
    assert "<h1>" not in content
    assert "<strong>" not in content
    assert "<a href" not in content
    assert "Title" in content
    assert "important text with links" in content