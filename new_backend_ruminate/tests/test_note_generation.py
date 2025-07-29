"""Test note generation from conversation functionality"""
import pytest
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime
from uuid import uuid4

from new_backend_ruminate.domain.document.entities import Document, Block, DocumentStatus, BlockType
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.context.renderers.note_generation import NoteGenerationContext
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.infrastructure.object_storage.local_storage import LocalObjectStorage


@pytest.fixture
def mock_doc_repo():
    """Mock document repository for testing"""
    return AsyncMock()


@pytest.fixture
def mock_conv_repo():
    """Mock conversation repository for testing"""
    return AsyncMock()


@pytest.fixture
def mock_llm_service():
    """Mock LLM service for testing"""
    mock = AsyncMock()
    mock.generate_response = AsyncMock(
        return_value="This conversation explored the concept of neural networks in deep learning. "
        "The discussion covered how neural networks with multiple hidden layers can learn "
        "complex patterns from data. Key points included the architecture of neural networks, "
        "their applications in computer vision and NLP, and the computational requirements for training."
    )
    return mock


@pytest.fixture
def sample_conversation():
    """Sample conversation for testing"""
    return Conversation(
        id="conv-123",
        user_id="test-user",
        document_id="doc-123",
        type=ConversationType.CHAT,
        created_at=datetime.now()
    )


@pytest.fixture
def sample_messages():
    """Sample conversation messages"""
    return [
        Message(
            id="msg-1",
            conversation_id="conv-123",
            parent_id=None,
            role=Role.SYSTEM,
            content="You are a helpful assistant.",
            user_id="test-user",
            version=0
        ),
        Message(
            id="msg-2",
            conversation_id="conv-123",
            parent_id="msg-1",
            role=Role.USER,
            content="Can you explain what neural networks are?",
            user_id="test-user",
            version=0
        ),
        Message(
            id="msg-3",
            conversation_id="conv-123",
            parent_id="msg-2",
            role=Role.ASSISTANT,
            content="Neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) organized in layers.",
            user_id="test-user",
            version=0
        ),
        Message(
            id="msg-4",
            conversation_id="conv-123",
            parent_id="msg-3",
            role=Role.USER,
            content="How do they learn complex patterns?",
            user_id="test-user",
            version=0
        ),
        Message(
            id="msg-5",
            conversation_id="conv-123",
            parent_id="msg-4",
            role=Role.ASSISTANT,
            content="Neural networks learn through a process called backpropagation, where they adjust their weights based on errors in predictions. Deep networks with multiple hidden layers can capture increasingly abstract features.",
            user_id="test-user",
            version=0
        )
    ]


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
def sample_block():
    """Sample block to attach note to"""
    return Block(
        id="block-target",
        document_id="doc-123",
        page_number=2,
        html_content="<p>Deep learning uses <strong>neural networks</strong> with multiple hidden layers to learn complex patterns from data.</p>",
        block_type=BlockType.LINE,
        metadata={}
    )


@pytest.mark.asyncio
class TestNoteGeneration:
    """Test the note generation functionality"""
    
    async def test_generate_note_from_conversation_success(
        self, 
        mock_doc_repo, 
        mock_llm_service, 
        sample_document, 
        sample_block, 
        sample_messages,
        tmp_path
    ):
        """Test successful note generation from conversation"""
        # Setup repository mocks
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_document.return_value = sample_document
        mock_doc_repo.update_block = AsyncMock()
        
        # Create service with mocked dependencies
        event_hub = EventStreamHub()
        storage = LocalObjectStorage(str(tmp_path))
        note_context = NoteGenerationContext()
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=event_hub,
            storage=storage,
            llm=mock_llm_service,
            note_context=note_context
        )
        
        # Mock session
        mock_session = AsyncMock()
        
        # Call the note generation method
        result = await service.generate_note_from_conversation(
            conversation_id="conv-123",
            block_id="block-target",
            messages=sample_messages,
            message_count=5,
            topic="Understanding neural networks",
            user_id="test-user",
            session=mock_session
        )
        
        # Verify result
        assert "note" in result
        assert "note_id" in result
        assert result["block_id"] == "block-target"
        assert result["conversation_id"] == "conv-123"
        assert "neural networks" in result["note"]
        assert "deep learning" in result["note"]
        
        # Verify repository calls
        mock_doc_repo.get_block.assert_called_with("block-target", mock_session)
        mock_doc_repo.get_document.assert_called_with("doc-123", mock_session)
        
        # Verify block was updated with annotation
        mock_doc_repo.update_block.assert_called_once()
        updated_block = mock_doc_repo.update_block.call_args[0][0]
        
        # Check annotation was added to metadata
        assert "annotations" in updated_block.metadata
        annotation_keys = list(updated_block.metadata["annotations"].keys())
        assert len(annotation_keys) == 1
        assert annotation_keys[0].startswith("generated-")
        
        # Verify annotation content
        annotation = updated_block.metadata["annotations"][annotation_keys[0]]
        assert annotation["is_generated"] is True
        assert annotation["source_conversation_id"] == "conv-123"
        assert annotation["message_count"] == 4  # Excludes system message
        assert annotation["topic"] == "Understanding neural networks"
        assert annotation["note"] == result["note"]
        
        # Verify LLM was called with proper context
        mock_llm_service.generate_response.assert_called_once()
        llm_messages = mock_llm_service.generate_response.call_args[0][0]
        assert len(llm_messages) == 2  # System + User prompt
        
        # Check system prompt contains document info
        system_msg = llm_messages[0]
        assert "Introduction to Machine Learning" in system_msg.content
        assert "Understanding neural networks" in system_msg.content
        
        # Check user prompt contains conversation
        user_msg = llm_messages[1]
        assert "Can you explain what neural networks are?" in user_msg.content
        assert "How do they learn complex patterns?" in user_msg.content
    
    async def test_generate_note_filters_messages(
        self,
        mock_doc_repo,
        mock_llm_service,
        sample_document,
        sample_block,
        sample_messages,
        tmp_path
    ):
        """Test that only user/assistant messages are included in note generation"""
        # Add tool message to test filtering
        tool_message = Message(
            id="msg-tool",
            conversation_id="conv-123",
            parent_id="msg-3",
            role=Role.TOOL,
            content="Tool output data",
            user_id="test-user",
            version=0
        )
        all_messages = sample_messages + [tool_message]
        
        # Setup
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_document.return_value = sample_document
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path)),
            llm=mock_llm_service,
            note_context=NoteGenerationContext()
        )
        
        mock_session = AsyncMock()
        
        # Generate note
        result = await service.generate_note_from_conversation(
            conversation_id="conv-123",
            block_id="block-target",
            messages=all_messages,
            message_count=10,  # Request more than available
            user_id="test-user",
            session=mock_session
        )
        
        # Verify LLM prompt doesn't include tool/system messages
        llm_messages = mock_llm_service.generate_response.call_args[0][0]
        user_prompt = llm_messages[1].content
        
        assert "Tool output data" not in user_prompt
        assert "You are a helpful assistant" not in user_prompt
        assert "Can you explain what neural networks are?" in user_prompt
    
    async def test_generate_note_respects_message_count(
        self,
        mock_doc_repo,
        mock_llm_service,
        sample_document,
        sample_block,
        sample_messages,
        tmp_path
    ):
        """Test that message_count parameter limits messages included"""
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_document.return_value = sample_document
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path)),
            llm=mock_llm_service,
            note_context=NoteGenerationContext()
        )
        
        mock_session = AsyncMock()
        
        # Generate note with only 2 messages
        await service.generate_note_from_conversation(
            conversation_id="conv-123",
            block_id="block-target",
            messages=sample_messages,
            message_count=2,
            user_id="test-user",
            session=mock_session
        )
        
        # Verify only last 2 user/assistant messages were included
        llm_messages = mock_llm_service.generate_response.call_args[0][0]
        user_prompt = llm_messages[1].content
        
        # Should include the last exchange only
        assert "How do they learn complex patterns?" in user_prompt
        assert "backpropagation" in user_prompt
        # Should NOT include the first exchange
        assert "Can you explain what neural networks are?" not in user_prompt
    
    async def test_generate_note_access_denied(
        self,
        mock_doc_repo,
        sample_document,
        sample_block,
        sample_messages,
        tmp_path
    ):
        """Test that note generation fails if user doesn't own document"""
        # Setup document with different user
        wrong_user_doc = Document(
            id="doc-123",
            user_id="other-user",
            title="Someone else's document",
            status=DocumentStatus.READY
        )
        
        mock_doc_repo.get_block.return_value = sample_block
        mock_doc_repo.get_document.return_value = wrong_user_doc
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path)),
            llm=AsyncMock(),
            note_context=NoteGenerationContext()
        )
        
        mock_session = AsyncMock()
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="access denied"):
            await service.generate_note_from_conversation(
                conversation_id="conv-123",
                block_id="block-target",
                messages=sample_messages,
                user_id="test-user",
                session=mock_session
            )
    
    async def test_generate_note_block_not_found(
        self,
        mock_doc_repo,
        sample_messages,
        tmp_path
    ):
        """Test that note generation fails if block doesn't exist"""
        mock_doc_repo.get_block.return_value = None
        
        service = DocumentService(
            repo=mock_doc_repo,
            hub=EventStreamHub(),
            storage=LocalObjectStorage(str(tmp_path)),
            llm=AsyncMock(),
            note_context=NoteGenerationContext()
        )
        
        mock_session = AsyncMock()
        
        with pytest.raises(ValueError, match="Block not found"):
            await service.generate_note_from_conversation(
                conversation_id="conv-123",
                block_id="non-existent",
                messages=sample_messages,
                user_id="test-user",
                session=mock_session
            )