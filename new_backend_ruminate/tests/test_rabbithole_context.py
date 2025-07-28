"""Tests for rabbithole conversation context building"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.context.builder import ContextBuilder
from new_backend_ruminate.context.renderers.rabbithole import rabbithole_system_renderer
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.document.entities.document import DocumentStatus
from new_backend_ruminate.domain.document.entities.block import BlockType
from new_backend_ruminate.infrastructure.document.models import DocumentModel, BlockModel


@pytest.fixture
def mock_session():
    """Mock AsyncSession for database operations"""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def sample_document():
    """Sample document with summary"""
    doc = MagicMock(spec=DocumentModel)
    doc.id = "doc-123"
    doc.title = "Understanding Machine Learning"
    doc.summary = "This document covers the fundamentals of machine learning, including supervised and unsupervised learning techniques, neural networks, and practical applications in data science."
    doc.status = DocumentStatus.READY
    return doc


@pytest.fixture
def sample_block():
    """Sample block with HTML content"""
    block = MagicMock(spec=BlockModel)
    block.id = "block-456"
    block.block_type = BlockType.LINE  # Use valid enum value
    block.html_content = """
    <p>Neural networks are computing systems inspired by biological neural networks. 
    They consist of <strong>interconnected nodes</strong> called neurons that process 
    information using connectionist approaches. <em>Deep learning</em> is a subset 
    of machine learning that uses neural networks with multiple layers.</p>
    """
    block.page_number = 5
    return block


@pytest.fixture
def rabbithole_conversation():
    """Sample rabbithole conversation"""
    conv = Conversation()
    conv.id = "conv-789"
    conv.type = ConversationType.RABBITHOLE
    conv.document_id = "doc-123"
    conv.source_block_id = "block-456"
    conv.selected_text = "Deep learning is a subset of machine learning that uses neural networks with multiple layers"
    conv.text_start_offset = 150
    conv.text_end_offset = 240
    return conv


@pytest.fixture
def system_message():
    """System message with rabbithole template"""
    msg = Message()
    msg.id = "msg-001"
    msg.conversation_id = "conv-789"
    msg.role = Role.SYSTEM
    msg.content = """This is a deep-dive conversation focused on a selected text from a document.

Selected text:
```
{selected_text}
```

{block_context}
{document_summary}

You are a helpful assistant focusing specifically on exploring this selected topic in depth.
Provide detailed analysis and insights based on this specific selection and its context.
Answer accurately, concisely, and precisely—avoid long lists of answers. Understand 
the user's question/comment intuitively and provide them a clear response. Answer naturally as well."""
    return msg


@pytest.mark.asyncio
class TestRabbitholeSystemRenderer:
    """Test the rabbithole system message renderer"""
    
    async def test_renders_complete_context(self, mock_session, sample_document, sample_block, 
                                          rabbithole_conversation, system_message):
        """Test that the renderer produces rich context with all components"""
        # Setup mocks
        mock_session.get.side_effect = lambda model, id: {
            ("doc-123",): sample_document,
            ("block-456",): sample_block
        }.get((id,))
        
        # Render the context
        result = await rabbithole_system_renderer(
            system_message, 
            rabbithole_conversation, 
            session=mock_session
        )
        
        # Verify all components are included
        assert "Deep learning is a subset of machine learning" in result
        assert "Neural networks are computing systems inspired by biological neural networks" in result
        assert "This document covers the fundamentals of machine learning" in result
        # Verify structure includes the key sections
        assert "Selected text:" in result
        assert "block of type 'Line'" in result
        
        # Verify HTML is stripped
        assert "<p>" not in result
        assert "<strong>" not in result
        assert "<em>" not in result
        assert "interconnected nodes" in result  # Content should be preserved
    
    async def test_handles_missing_document(self, mock_session, rabbithole_conversation, system_message):
        """Test error handling when document is not found"""
        mock_session.get.return_value = None
        
        with pytest.raises(ValueError, match="Document doc-123 not found"):
            await rabbithole_system_renderer(
                system_message,
                rabbithole_conversation,
                session=mock_session
            )
    
    async def test_handles_missing_block(self, mock_session, sample_document, 
                                       rabbithole_conversation, system_message):
        """Test graceful handling when block is not found"""
        # Document exists but block doesn't
        mock_session.get.side_effect = lambda model, id: {
            ("doc-123",): sample_document,
            ("block-456",): None
        }.get((id,))
        
        result = await rabbithole_system_renderer(
            system_message,
            rabbithole_conversation,
            session=mock_session
        )
        
        # Should still include selected text and document summary
        assert "Deep learning is a subset of machine learning" in result
        assert "This document covers the fundamentals of machine learning" in result
        # But no block context
        assert "Neural networks are computing systems" not in result
    
    async def test_handles_no_selected_text(self, mock_session, sample_document, sample_block):
        """Test handling conversation without selected text"""
        conversation = Conversation()
        conversation.id = "conv-789"
        conversation.type = ConversationType.RABBITHOLE
        conversation.document_id = "doc-123"
        conversation.source_block_id = "block-456"
        conversation.selected_text = None  # No selected text
        conversation.text_start_offset = None
        conversation.text_end_offset = None
        
        system_message = Message()
        system_message.id = "msg-001"
        system_message.conversation_id = "conv-789"
        system_message.role = Role.SYSTEM
        system_message.content = "Selected text: ```{selected_text}``` {block_context} {document_summary}"
        
        mock_session.get.side_effect = lambda model, id: {
            ("doc-123",): sample_document,
            ("block-456",): sample_block
        }.get((id,))
        
        result = await rabbithole_system_renderer(
            system_message,
            conversation,
            session=mock_session
        )
        
        # Should handle empty selected text gracefully
        assert "Selected text: ``````" in result
        assert "Neural networks are computing systems" in result
        assert "This document covers the fundamentals" in result
    
    async def test_handles_no_document_summary(self, mock_session, sample_block, rabbithole_conversation, system_message):
        """Test handling document without summary"""
        # Document without summary
        doc_without_summary = MagicMock(spec=DocumentModel)
        doc_without_summary.id = "doc-123"
        doc_without_summary.title = "Understanding Machine Learning"
        doc_without_summary.summary = None
        
        mock_session.get.side_effect = lambda model, id: {
            ("doc-123",): doc_without_summary,
            ("block-456",): sample_block
        }.get((id,))
        
        result = await rabbithole_system_renderer(
            system_message,
            rabbithole_conversation,
            session=mock_session
        )
        
        # Should include selected text and block context but no document summary
        assert "Deep learning is a subset of machine learning" in result
        assert "Neural networks are computing systems" in result
        assert "This document covers the fundamentals" not in result
    
    async def test_block_type_in_context(self, mock_session, sample_document, rabbithole_conversation, system_message):
        """Test that block type is included in context"""
        # Create blocks of different types
        heading_block = MagicMock(spec=BlockModel)
        heading_block.id = "block-456"
        heading_block.block_type = BlockType.CAPTION  # Use valid enum value
        heading_block.html_content = "<h2>Introduction to Neural Networks</h2>"
        
        mock_session.get.side_effect = lambda model, id: {
            ("doc-123",): sample_document,
            ("block-456",): heading_block
        }.get((id,))
        
        result = await rabbithole_system_renderer(
            system_message,
            rabbithole_conversation,
            session=mock_session
        )
        
        assert "block of type 'Caption'" in result
        assert "Introduction to Neural Networks" in result


@pytest.mark.asyncio
class TestRabbitholeContextBuilder:
    """Test the full context building process for rabbithole conversations"""
    
    async def test_full_context_building(self, mock_session, sample_document, sample_block):
        """Test complete context building with multiple messages"""
        # Create conversation and messages
        conversation = Conversation()
        conversation.id = "conv-789"
        conversation.type = ConversationType.RABBITHOLE
        conversation.document_id = "doc-123"
        conversation.source_block_id = "block-456"
        conversation.selected_text = "Deep learning is a subset of machine learning"
        conversation.text_start_offset = 150
        conversation.text_end_offset = 200
        
        # Create system message
        msg1 = Message()
        msg1.id = "msg-001"
        msg1.conversation_id = "conv-789"
        msg1.role = Role.SYSTEM
        msg1.content = """This is a deep-dive conversation focused on a selected text from a document.

Selected text: ```{selected_text}```
{block_context}
{document_summary}

You are a helpful assistant focusing specifically on exploring this selected topic in depth."""
        
        # Create user message
        msg2 = Message()
        msg2.id = "msg-002"
        msg2.conversation_id = "conv-789"
        msg2.role = Role.USER
        msg2.content = "Can you explain how deep learning differs from traditional machine learning?"
        
        # Create assistant message
        msg3 = Message()
        msg3.id = "msg-003"
        msg3.conversation_id = "conv-789"
        msg3.role = Role.ASSISTANT
        msg3.content = "Deep learning differs from traditional machine learning in several key ways..."
        
        messages = [msg1, msg2, msg3]
        
        # Setup mocks
        mock_session.get.side_effect = lambda model, id: {
            ("doc-123",): sample_document,
            ("block-456",): sample_block
        }.get((id,))
        
        # Build context
        builder = ContextBuilder()
        context = await builder.build(conversation, messages, session=mock_session)
        
        # Verify structure
        assert len(context) == 3
        assert context[0]["role"] == "system"
        assert context[1]["role"] == "user"
        assert context[2]["role"] == "assistant"
        
        # Verify rich system context
        system_content = context[0]["content"]
        assert "Deep learning is a subset of machine learning" in system_content
        assert "Neural networks are computing systems" in system_content
        assert "This document covers the fundamentals" in system_content
        
        # Verify other messages are preserved
        assert context[1]["content"] == "Can you explain how deep learning differs from traditional machine learning?"
        assert "Deep learning differs from traditional machine learning" in context[2]["content"]
    
    async def test_context_with_no_block_id(self, mock_session, sample_document):
        """Test context building when conversation has no source_block_id"""
        conversation = Conversation()
        conversation.id = "conv-789"
        conversation.type = ConversationType.RABBITHOLE
        conversation.document_id = "doc-123"
        conversation.source_block_id = None  # No specific block
        conversation.selected_text = "machine learning concepts"
        conversation.text_start_offset = None
        conversation.text_end_offset = None
        
        system_message = Message()
        system_message.id = "msg-001"
        system_message.conversation_id = "conv-789"
        system_message.role = Role.SYSTEM
        system_message.content = "Selected text: ```{selected_text}``` {block_context} {document_summary}"
        
        mock_session.get.side_effect = lambda model, id: sample_document if id == "doc-123" else None
        
        builder = ContextBuilder()
        context = await builder.build(conversation, [system_message], session=mock_session)
        
        # Should include selected text and document summary but no block context
        system_content = context[0]["content"]
        assert "machine learning concepts" in system_content
        assert "This document covers the fundamentals" in system_content
        # Should not have block context section
        assert "block of type" not in system_content


@pytest.mark.asyncio
class TestRabbitholeContextQuality:
    """Test the quality and richness of rabbithole context"""
    
    async def test_context_richness_metrics(self, mock_session, sample_document, sample_block, 
                                          rabbithole_conversation, system_message):
        """Test that context provides rich, comprehensive information"""
        mock_session.get.side_effect = lambda model, id: {
            ("doc-123",): sample_document,
            ("block-456",): sample_block
        }.get((id,))
        
        result = await rabbithole_system_renderer(
            system_message,
            rabbithole_conversation,
            session=mock_session
        )
        
        # Verify multiple context layers
        context_components = [
            "Deep learning is a subset of machine learning",  # Selected text
            "Neural networks are computing systems",           # Block context
            "This document covers the fundamentals",          # Document summary
            # Note: Document title is not included in the current template
        ]
        
        for component in context_components:
            assert component in result, f"Missing context component: {component}"
        
        # Verify context is substantial (not just fragments)
        assert len(result) > 500, "Context should be substantial"
        
        # Verify proper structure
        assert "Selected text:" in result
        assert "```" in result  # Code blocks for selected text
        assert "block of type" in result  # Block type information
    
    async def test_html_cleaning_quality(self, mock_session, sample_document, rabbithole_conversation, system_message):
        """Test that HTML is properly cleaned while preserving content"""
        # Block with complex HTML
        complex_block = MagicMock(spec=BlockModel)
        complex_block.id = "block-456"
        complex_block.block_type = BlockType.LINE
        complex_block.html_content = """
        <div class="content">
            <p>This is a <strong>complex</strong> paragraph with 
            <a href="link">links</a>, <em>emphasis</em>, and 
            <code>code snippets</code>.</p>
            <ul>
                <li>List item 1</li>
                <li>List item 2 with <span style="color: red;">styling</span></li>
            </ul>
        </div>
        """
        
        mock_session.get.side_effect = lambda model, id: {
            ("doc-123",): sample_document,
            ("block-456",): complex_block
        }.get((id,))
        
        result = await rabbithole_system_renderer(
            system_message,
            rabbithole_conversation,
            session=mock_session
        )
        
        # HTML tags should be removed
        html_tags = ["<div>", "<p>", "<strong>", "<a>", "<em>", "<code>", "<ul>", "<li>", "<span>"]
        for tag in html_tags:
            assert tag not in result
        
        # Content should be preserved
        assert "complex paragraph" in result
        assert "links" in result
        assert "code snippets" in result
        assert "List item 1" in result
        assert "List item 2" in result
        
        # Text should be properly spaced
        assert "  " not in result  # No double spaces
        assert result.strip() == result  # No leading/trailing whitespace