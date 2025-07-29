"""Test document definition service functionality"""
import pytest
from unittest.mock import AsyncMock, Mock, patch
from pathlib import Path

from new_backend_ruminate.domain.document.entities import Document, Page, Block, DocumentStatus, BlockType
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.infrastructure.object_storage.local_storage import LocalObjectStorage


@pytest.fixture
def mock_doc_repo():
    """Mock document repository for testing"""
    return AsyncMock()


@pytest.fixture
def mock_llm_service():
    """Mock LLM service for testing"""
    mock = AsyncMock()
    mock.generate_response = AsyncMock(return_value="A neural network is a computational model inspired by biological neural networks, consisting of interconnected nodes that process information in layers.")
    return mock


@pytest.fixture
def sample_document():
    """Sample document for testing"""
    return Document(
        id="doc-123",
        user_id="test-user",
        title="Introduction to Machine Learning",
        summary="A comprehensive guide to ML concepts including neural networks, deep learning, and practical applications.",
        status=DocumentStatus.READY
    )


@pytest.fixture
def sample_blocks():
    """Sample blocks with neural network content"""
    return [
        Block(
            id="block-1",
            document_id="doc-123",
            page_number=1,
            html_content="<h1>Chapter 1: Introduction</h1><p>Machine learning is a subset of artificial intelligence.</p>",
            block_type=BlockType.LINE
        ),
        Block(
            id="block-2",
            document_id="doc-123",
            page_number=2,
            html_content="<h2>Neural Network Basics</h2><p>A neural network consists of layers of interconnected nodes.</p>",
            block_type=BlockType.LINE
        ),
        Block(
            id="block-target",
            document_id="doc-123",
            page_number=2,
            html_content="<p>Deep learning uses <strong>neural networks</strong> with multiple hidden layers to learn complex patterns from data.</p>",
            block_type=BlockType.LINE
        ),
        Block(
            id="block-4",
            document_id="doc-123",
            page_number=3,
            html_content="<p>Applications include computer vision, natural language processing, and speech recognition.</p>",
            block_type=BlockType.LINE
        ),
        Block(
            id="block-5",
            document_id="doc-123",
            page_number=3,
            html_content="<p>Training neural networks requires large datasets and computational resources.</p>",
            block_type=BlockType.LINE
        )
    ]


@pytest.mark.asyncio
class TestDefinitionService:
    """Test the definition generation functionality"""
    
    async def test_get_term_definition_success(self, mock_doc_repo, mock_llm_service, sample_document, sample_blocks, tmp_path):
        """Test successful definition generation with proper session management"""
        # Setup repository mocks
        mock_doc_repo.get_document.return_value = sample_document
        mock_doc_repo.get_block.return_value = sample_blocks[2]  # block-target
        mock_doc_repo.get_blocks_by_document.return_value = sample_blocks
        
        # Create service
        event_hub = EventStreamHub()
        storage = LocalObjectStorage(str(tmp_path))
        service = DocumentService(
            repo=mock_doc_repo,
            hub=event_hub,
            storage=storage
        )
        
        # Patch LLM service
        with patch('new_backend_ruminate.dependencies.get_llm_service', return_value=mock_llm_service):
            # Call the definition method
            result = await service.get_term_definition(
                document_id="doc-123",
                block_id="block-target",
                term="neural networks",
                text_start_offset=20,
                text_end_offset=35,
                surrounding_text="Deep learning uses neural networks with multiple hidden layers",
                user_id="test-user"
            )
        
        # Verify result
        assert result["term"] == "neural networks"
        assert "neural network is a computational model" in result["definition"]
        assert "[TARGET BLOCK]" in result["context"]
        assert "Deep learning uses neural networks" in result["context"]
        
        # Verify repository calls happened within session scope
        assert mock_doc_repo.get_document.called
        assert mock_doc_repo.get_block.called
        assert mock_doc_repo.get_blocks_by_document.called
        
        # Verify LLM was called with proper context
        mock_llm_service.generate_response.assert_called_once()
        messages = mock_llm_service.generate_response.call_args[0][0]
        assert len(messages) == 2
        assert "neural networks" in messages[1].content
        assert "Introduction to Machine Learning" in messages[0].content
    
    async def test_get_term_definition_with_surrounding_text(self, mock_doc_repo, mock_llm_service, sample_document, sample_blocks, tmp_path):
        """Test definition generation with additional surrounding text context"""
        # Setup
        mock_doc_repo.get_document.return_value = sample_document
        mock_doc_repo.get_block.return_value = sample_blocks[2]
        mock_doc_repo.get_blocks_by_document.return_value = sample_blocks
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path))
        )
        
        with patch('new_backend_ruminate.dependencies.get_llm_service', return_value=mock_llm_service):
            result = await service.get_term_definition(
                document_id="doc-123",
                block_id="block-target",
                term="hidden layers",
                text_start_offset=45,
                text_end_offset=58,
                surrounding_text="In the context of deep learning architectures, hidden layers are the intermediate layers between input and output",
                user_id="test-user"
            )
        
        # Verify surrounding text is included in context
        assert "Specific context around the term:" in result["context"]
        assert "deep learning architectures" in result["context"]
    
    async def test_get_term_definition_document_not_found(self, mock_doc_repo, tmp_path):
        """Test error when document is not found"""
        mock_doc_repo.get_document.return_value = None
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path))
        )
        
        with pytest.raises(ValueError, match="Document not found or access denied"):
            await service.get_term_definition(
                document_id="non-existent",
                block_id="block-1",
                term="test",
                surrounding_text=None,
                user_id="test-user"
            )
    
    async def test_get_term_definition_wrong_user(self, mock_doc_repo, sample_document, tmp_path):
        """Test error when user doesn't have access to document"""
        # Document belongs to different user
        sample_document.user_id = "different-user"
        mock_doc_repo.get_document.return_value = sample_document
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path))
        )
        
        with pytest.raises(ValueError, match="Document not found or access denied"):
            await service.get_term_definition(
                document_id="doc-123",
                block_id="block-1",
                term="test",
                surrounding_text=None,
                user_id="test-user"
            )
    
    async def test_get_term_definition_block_not_found(self, mock_doc_repo, sample_document, tmp_path):
        """Test error when block is not found"""
        mock_doc_repo.get_document.return_value = sample_document
        mock_doc_repo.get_block.return_value = None
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path))
        )
        
        with pytest.raises(ValueError, match="Block not found or does not belong to document"):
            await service.get_term_definition(
                document_id="doc-123",
                block_id="non-existent",
                term="test",
                surrounding_text=None,
                user_id="test-user"
            )
    
    async def test_get_term_definition_block_wrong_document(self, mock_doc_repo, sample_document, sample_blocks, tmp_path):
        """Test error when block belongs to different document"""
        mock_doc_repo.get_document.return_value = sample_document
        
        # Block with different document_id
        wrong_block = Block(
            id="block-wrong",
            document_id="different-doc",
            page_number=1,
            html_content="<p>Content</p>",
            block_type=BlockType.LINE
        )
        mock_doc_repo.get_block.return_value = wrong_block
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path))
        )
        
        with pytest.raises(ValueError, match="Block not found or does not belong to document"):
            await service.get_term_definition(
                document_id="doc-123",
                block_id="block-wrong",
                term="test",
                surrounding_text=None,
                user_id="test-user"
            )
    
    async def test_get_term_definition_context_window(self, mock_doc_repo, mock_llm_service, sample_document, sample_blocks, tmp_path):
        """Test that context window includes 2 blocks before and after target"""
        mock_doc_repo.get_document.return_value = sample_document
        mock_doc_repo.get_block.return_value = sample_blocks[2]  # block-target
        mock_doc_repo.get_blocks_by_document.return_value = sample_blocks
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path))
        )
        
        with patch('new_backend_ruminate.dependencies.get_llm_service', return_value=mock_llm_service):
            result = await service.get_term_definition(
                document_id="doc-123",
                block_id="block-target",
                term="neural networks",
                surrounding_text=None,
                user_id="test-user"
            )
        
        # Verify context includes surrounding blocks
        context = result["context"]
        assert "Neural Network Basics" in context  # block-2
        assert "[TARGET BLOCK]" in context  # block-target marked
        assert "Deep learning uses" in context  # target content
        assert "Applications include" in context  # block-4
        assert "Training neural networks" in context  # block-5
        
        # block-1 is actually included (it's within 2 blocks of target)
        assert "Chapter 1: Introduction" in context