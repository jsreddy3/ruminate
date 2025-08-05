"""Test document info extraction functionality"""
import pytest
from unittest.mock import Mock, AsyncMock
from new_backend_ruminate.infrastructure.document_processing.llm_document_analyzer import LLMDocumentAnalyzer
from new_backend_ruminate.domain.document.entities.block import Block


@pytest.mark.asyncio
async def test_generate_document_info_with_structured_output():
    """Test that document info extraction uses structured output"""
    # Mock LLM service
    mock_llm = Mock()
    mock_llm.generate_structured_response = AsyncMock(return_value={
        "document_info": "This is a research paper on quantum computing published in Nature.",
        "author": "Dr. Jane Smith",
        "title": "Quantum Computing: Recent Advances and Applications"
    })
    
    # Create analyzer
    analyzer = LLMDocumentAnalyzer(mock_llm)
    
    # Create test blocks
    blocks = [
        Block(
            id="1",
            document_id="doc123",
            page_number=0,
            html_content="<h1>Quantum Computing</h1><p>By Dr. Jane Smith</p>"
        ),
        Block(
            id="2", 
            document_id="doc123",
            page_number=0,
            html_content="<p>Abstract: This paper presents recent advances...</p>"
        )
    ]
    
    # Generate info
    result = await analyzer.generate_document_info(blocks, "quantum_paper.pdf")
    
    # Verify structured output was called
    mock_llm.generate_structured_response.assert_called_once()
    call_args = mock_llm.generate_structured_response.call_args
    
    # Check response format and schema
    assert call_args.kwargs["response_format"] == {"type": "json_object"}
    assert "json_schema" in call_args.kwargs
    schema = call_args.kwargs["json_schema"]
    assert schema["type"] == "object"
    assert "document_info" in schema["properties"]
    assert "author" in schema["properties"]
    assert "title" in schema["properties"]
    
    # Check result
    assert result["document_info"] == "This is a research paper on quantum computing published in Nature."
    assert result["author"] == "Dr. Jane Smith"
    assert result["title"] == "Quantum Computing: Recent Advances and Applications"


@pytest.mark.asyncio
async def test_document_info_extraction_limits_to_5_pages():
    """Test that only first 5 pages are processed"""
    mock_llm = Mock()
    mock_llm.generate_structured_response = AsyncMock(return_value={
        "document_info": "Test document",
        "author": "Test Author",
        "title": "Test Title"
    })
    
    analyzer = LLMDocumentAnalyzer(mock_llm)
    
    # Create blocks from 10 pages
    blocks = []
    for page in range(10):
        for i in range(3):  # 3 blocks per page
            blocks.append(Block(
                id=f"block_{page}_{i}",
                document_id="doc123",
                page_number=page,
                html_content=f"<p>Page {page} content {i}</p>"
            ))
    
    await analyzer.generate_document_info(blocks, "long_document.pdf")
    
    # Check that content was limited
    call_args = mock_llm.generate_structured_response.call_args
    messages = call_args.kwargs["messages"]
    user_content = messages[1].content
    
    # Should only contain content from pages 0-4
    assert "Page 0" in user_content
    assert "Page 4" in user_content
    assert "Page 5" not in user_content
    assert "Page 9" not in user_content


@pytest.mark.asyncio
async def test_document_info_handles_empty_blocks():
    """Test graceful handling of empty blocks"""
    mock_llm = Mock()
    analyzer = LLMDocumentAnalyzer(mock_llm)
    
    # Empty blocks
    blocks = []
    
    result = await analyzer.generate_document_info(blocks, "empty.pdf")
    
    # Should return fallback values without calling LLM
    mock_llm.generate_structured_response.assert_not_called()
    assert result["document_info"] == "Unable to extract information from 'empty.pdf'"
    assert result["author"] == "Unknown"
    assert result["title"] == "empty.pdf"