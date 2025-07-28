"""Tests for the windowed context builder system"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.context.windowed.builder import WindowedContextBuilder
from new_backend_ruminate.context.windowed.context_window import ContextWindow
from new_backend_ruminate.context.windowed.providers import (
    SystemPromptProvider,
    DocumentSummaryProvider,
    PageRangeProvider,
    ConversationHistoryProvider
)
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.document.entities import Document, Page, Block, DocumentStatus, BlockType
from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository


@pytest.fixture
def mock_doc_repo():
    """Mock document repository for testing"""
    return AsyncMock(spec=RDSDocumentRepository)


@pytest.fixture
def sample_document():
    """Sample document for testing"""
    return Document(
        id="doc-123",
        title="Understanding Machine Learning",
        summary="This document covers fundamentals of ML including supervised learning, neural networks, and applications in data science. Key topics include classification, regression, deep learning architectures, and model evaluation techniques.",
        status=DocumentStatus.READY
    )


@pytest.fixture
def sample_pages():
    """Sample pages with content for testing"""
    return [
        Page(
            id="page-1",
            document_id="doc-123",
            page_number=4,
            html_content="<h1>Chapter 4: Neural Networks</h1><p>Introduction to neural network concepts.</p>"
        ),
        Page(
            id="page-2", 
            document_id="doc-123",
            page_number=5,
            html_content="<h2>Deep Learning Fundamentals</h2><p>Deep learning uses neural networks with multiple layers to learn complex patterns from data.</p>"
        ),
        Page(
            id="page-3",
            document_id="doc-123", 
            page_number=6,
            html_content="<p>Applications include computer vision, natural language processing, and speech recognition.</p>"
        )
    ]


@pytest.fixture
def sample_block():
    """Sample block for testing"""
    return Block(
        id="block-456",
        document_id="doc-123",
        page_number=5,
        html_content="<p>Deep learning uses <strong>neural networks</strong> with multiple layers to learn complex patterns from data.</p>",
        block_type=BlockType.LINE
    )


@pytest.fixture 
def chat_conversation():
    """Normal chat conversation for testing"""
    return Conversation(
        id="conv-chat",
        type=ConversationType.CHAT,
        document_id="doc-123"
    )


@pytest.fixture
def rabbithole_conversation():
    """Rabbithole conversation for testing"""
    return Conversation(
        id="conv-rabbit",
        type=ConversationType.RABBITHOLE,
        document_id="doc-123",
        source_block_id="block-456",
        selected_text="neural networks with multiple layers",
        text_start_offset=20,
        text_end_offset=55
    )


@pytest.fixture
def sample_thread():
    """Sample conversation thread"""
    return [
        Message(
            id="msg-system",
            conversation_id="conv-test",
            role=Role.SYSTEM,
            content="You are a helpful assistant."
        ),
        Message(
            id="msg-user-1", 
            conversation_id="conv-test",
            role=Role.USER,
            content="What is deep learning?",
            block_id="block-456"  # User is looking at specific block
        ),
        Message(
            id="msg-assistant-1",
            conversation_id="conv-test", 
            role=Role.ASSISTANT,
            content="Deep learning is a subset of machine learning..."
        )
    ]


@pytest.mark.asyncio
class TestPageRangeProvider:
    """Test the page range derivation and content provision"""
    
    async def test_chat_conversation_dynamic_page_derivation(self, mock_doc_repo, chat_conversation, sample_thread, sample_block, sample_pages):
        """Test that chat conversations derive page from latest user message"""
        # Setup mocks
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_pages_in_range.return_value = sample_pages
        
        provider = PageRangeProvider(mock_doc_repo, page_radius=1)
        mock_session = AsyncMock()
        
        result = await provider.get_page_content(
            chat_conversation,
            sample_thread,
            session=mock_session
        )
        
        # Should derive page 5 from block-456 in latest user message
        mock_doc_repo.get_block.assert_called_with("block-456", mock_session)
        mock_doc_repo.get_pages_in_range.assert_called_with("doc-123", 5, 1, mock_session)
        
        # Should format pages with current page marker
        assert "--- Page 5 (CURRENT) ---" in result
        assert "Deep Learning Fundamentals" in result
        assert "<h2>" not in result  # HTML should be stripped
    
    async def test_rabbithole_conversation_fixed_page_derivation(self, mock_doc_repo, rabbithole_conversation, sample_thread, sample_block, sample_pages):
        """Test that rabbithole conversations use fixed source_block_id"""
        # Setup mocks - same block but different user message block
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_pages_in_range.return_value = sample_pages
        
        # Modify thread to have user looking at different block
        thread_with_different_block = sample_thread.copy()
        thread_with_different_block[1].block_id = "block-999"  # Different block
        
        provider = PageRangeProvider(mock_doc_repo, page_radius=1)
        mock_session = AsyncMock()
        
        result = await provider.get_page_content(
            rabbithole_conversation,
            thread_with_different_block,
            session=mock_session
        )
        
        # Should still use source_block_id from conversation, NOT latest message
        mock_doc_repo.get_block.assert_called_with("block-456", mock_session)
        mock_doc_repo.get_pages_in_range.assert_called_with("doc-123", 5, 1, mock_session) 
        
        assert "--- Page 5 (CURRENT) ---" in result
    
    async def test_page_range_radius(self, mock_doc_repo, chat_conversation, sample_thread, sample_block):
        """Test that page radius works correctly"""
        # Pages 3-7 around center page 5
        pages_range = [
            Page(id=f"page-{i}", document_id="doc-123", page_number=i, html_content=f"<p>Page {i} content</p>")
            for i in range(3, 8)
        ]
        
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_pages_in_range.return_value = pages_range
        
        provider = PageRangeProvider(mock_doc_repo, page_radius=2)
        mock_session = AsyncMock()
        
        await provider.get_page_content(chat_conversation, sample_thread, session=mock_session)
        
        # Should request pages 3-7 (5 ± 2)
        mock_doc_repo.get_pages_in_range.assert_called_with("doc-123", 5, 2, mock_session)
    
    async def test_no_block_fallback(self, mock_doc_repo, chat_conversation, sample_pages):
        """Test fallback when no block is found"""
        thread_no_block = [
            Message(id="msg-1", role=Role.USER, content="Hello", block_id=None)
        ]
        
        mock_doc_repo.get_block.return_value = None
        
        provider = PageRangeProvider(mock_doc_repo, page_radius=1)
        
        result = await provider.get_page_content(
            chat_conversation,
            thread_no_block, 
            session=AsyncMock()
        )
        
        # Should return empty string when no page can be derived
        assert result == ""


@pytest.mark.asyncio
class TestDocumentSummaryProvider:
    """Test document summary provision"""
    
    async def test_document_summary_retrieval(self, sample_document):
        """Test that document summary is retrieved correctly"""
        mock_doc_repo = AsyncMock()
        mock_doc_repo.get_document.return_value = sample_document
        
        provider = DocumentSummaryProvider()
        mock_session = AsyncMock()
        mock_session.get.return_value = sample_document  # Mock session.get for DocumentModel
        
        conv = Conversation(id="conv-1", document_id="doc-123")
        result = await provider.get_document_summary(conv, session=mock_session)
        
        assert result == sample_document.summary
        assert "fundamentals of ML" in result
    
    async def test_no_document_fallback(self):
        """Test fallback when no document is associated"""
        mock_doc_repo = AsyncMock()
        
        provider = DocumentSummaryProvider()
        
        conv = Conversation(id="conv-1", document_id=None)  # No document
        result = await provider.get_document_summary(conv, session=AsyncMock())
        
        assert result == ""
    
    async def test_document_not_found(self):
        """Test fallback when document doesn't exist"""
        mock_doc_repo = AsyncMock()
        mock_doc_repo.get_document.return_value = None
        
        provider = DocumentSummaryProvider()
        
        conv = Conversation(id="conv-1", document_id="doc-missing")
        result = await provider.get_document_summary(conv, session=AsyncMock())
        
        assert result == ""


@pytest.mark.asyncio 
class TestConversationHistoryProvider:
    """Test conversation history rendering"""
    
    async def test_normal_conversation_history(self, sample_thread):
        """Test that normal conversations render messages as-is"""
        conv = Conversation(type=ConversationType.CHAT)
        provider = ConversationHistoryProvider(AsyncMock())
        
        result = await provider.render_conversation_history(
            conv,
            sample_thread,
            session=AsyncMock()
        )
        
        # Should skip system message and include user/assistant
        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "What is deep learning?"
        assert result[1]["role"] == "assistant"
        assert "Deep learning is a subset" in result[1]["content"]
    
    async def test_rabbithole_first_message_enhancement(self, sample_thread, sample_block):
        """Test that rabbithole conversations enhance first user message"""
        conv = Conversation(
            type=ConversationType.RABBITHOLE,
            source_block_id="block-456",
            selected_text="neural networks with multiple layers"
        )
        
        mock_session = AsyncMock()
        mock_session.get.return_value = sample_block
        
        provider = ConversationHistoryProvider(AsyncMock())
        
        result = await provider.render_conversation_history(
            conv,
            sample_thread,
            session=mock_session
        )
        
        # First user message should be enhanced
        enhanced_content = result[0]["content"]
        assert "neural networks with multiple layers" in enhanced_content
        assert "What is deep learning?" in enhanced_content  # Original content preserved
        assert "Block context:" in enhanced_content  # Block context added


@pytest.mark.asyncio
class TestWindowedContextBuilder:
    """Test the complete windowed context builder"""
    
    async def test_full_context_building_chat(self, mock_doc_repo, chat_conversation, sample_thread, sample_document, sample_block, sample_pages):
        """Test complete context building for chat conversation"""
        # Setup all mocks
        mock_doc_repo.get_document.return_value = sample_document
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_pages_in_range.return_value = sample_pages
        
        builder = WindowedContextBuilder(mock_doc_repo, page_radius=1)
        
        result = await builder.build(
            chat_conversation,
            sample_thread,
            session=AsyncMock()
        )
        
        # Should return LLM-ready messages
        assert len(result) >= 2  # System + conversation messages
        assert result[0]["role"] == "system"
        
        # System message should contain all four parts
        system_content = result[0]["content"]
        assert "You are a helpful assistant" in system_content  # System prompt
        assert "fundamentals of ML" in system_content  # Document summary
        assert "--- Page 5 (CURRENT) ---" in system_content  # Page content
        
        # Conversation history should follow
        assert result[1]["role"] == "user"
        assert result[2]["role"] == "assistant"
    
    async def test_full_context_building_rabbithole(self, mock_doc_repo, rabbithole_conversation, sample_thread, sample_document, sample_block, sample_pages):
        """Test complete context building for rabbithole conversation"""
        # Setup all mocks
        mock_doc_repo.get_document.return_value = sample_document  
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_pages_in_range.return_value = sample_pages
        
        mock_session = AsyncMock()
        mock_session.get.return_value = sample_block
        
        builder = WindowedContextBuilder(mock_doc_repo, page_radius=1)
        
        result = await builder.build(
            rabbithole_conversation,
            sample_thread,
            session=mock_session
        )
        
        # System message should have rabbithole-specific content
        system_content = result[0]["content"]
        assert "neural networks with multiple layers" in system_content  # Selected text
        assert "deep-dive conversation" in system_content  # Rabbithole system prompt
        
        # First user message should be enhanced
        user_content = result[1]["content"] 
        assert "neural networks with multiple layers" in user_content  # Enhanced content
    
    async def test_context_window_combination(self):
        """Test that ContextWindow combines parts correctly"""
        window = ContextWindow(
            system_prompt="You are a helpful assistant.",
            document_summary="Document about machine learning fundamentals.",
            page_content="--- Page 5 ---\nDeep learning content here.",
            conversation_history=[
                {"role": "user", "content": "What is deep learning?"},
                {"role": "assistant", "content": "Deep learning is..."}
            ]
        )
        
        result = window.to_llm_messages()
        
        # Should have system message + conversation
        assert len(result) == 3
        assert result[0]["role"] == "system"
        
        # System content should combine all context parts
        system_content = result[0]["content"]
        assert "You are a helpful assistant" in system_content
        assert "Document Summary" in system_content  
        assert "Document Context" in system_content
        assert "machine learning fundamentals" in system_content
        assert "Deep learning content here" in system_content
        
        # Conversation history should follow
        assert result[1]["role"] == "user"
        assert result[2]["role"] == "assistant"


@pytest.mark.asyncio
class TestEdgeCases:
    """Test edge cases and error conditions"""
    
    async def test_missing_document(self, mock_doc_repo, chat_conversation, sample_thread):
        """Test handling when document is missing"""
        mock_doc_repo.get_document.return_value = None
        mock_doc_repo.get_block.return_value = None
        mock_doc_repo.get_pages_in_range.return_value = []
        
        builder = WindowedContextBuilder(mock_doc_repo)
        
        result = await builder.build(
            chat_conversation,
            sample_thread,
            session=AsyncMock()
        )
        
        # Should still work with empty context parts
        assert len(result) >= 2
        system_content = result[0]["content"]
        assert "You are a helpful assistant" in system_content  # Base system prompt
    
    async def test_conversation_without_document(self, mock_doc_repo, sample_thread):
        """Test conversation with no associated document"""
        conv = Conversation(id="conv-1", type=ConversationType.CHAT, document_id=None)
        
        builder = WindowedContextBuilder(mock_doc_repo)
        
        result = await builder.build(conv, sample_thread, session=AsyncMock())
        
        # Should work with minimal context
        assert len(result) >= 2
        assert result[0]["role"] == "system"