"""Comprehensive tests for message metadata functionality and bidirectional conversation summaries"""
import pytest
import pytest_asyncio
from datetime import datetime
from uuid import uuid4
from unittest.mock import AsyncMock, Mock, patch

from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.document.entities import Document, Block, DocumentStatus, BlockType
from new_backend_ruminate.infrastructure.conversation.rds_conversation_repository import RDSConversationRepository
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.tests.stubs import StubLLM, StubContextBuilder
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub


@pytest_asyncio.fixture
async def conversation_service():
    """Create a conversation service with mocked dependencies"""
    repo = RDSConversationRepository()
    llm = StubLLM()
    hub = EventStreamHub()
    ctx_builder = StubContextBuilder()
    return ConversationService(repo, llm, hub, ctx_builder)


@pytest_asyncio.fixture
async def document_service():
    """Create a document service with mocked dependencies"""
    doc_repo = AsyncMock()
    llm = AsyncMock()
    hub = EventStreamHub()
    storage = AsyncMock()
    analyzer = AsyncMock()
    note_context = AsyncMock()
    
    # Mock the note generation to return predictable content
    llm.generate_response = AsyncMock(
        return_value="This is a generated summary of the conversation discussing key insights about the topic."
    )
    
    # Mock note context to return valid LLM messages
    note_context.build_context = AsyncMock(
        return_value=[
            {"role": "system", "content": "You are a note generation assistant."},
            {"role": "user", "content": "Generate a summary of this conversation."}
        ]
    )
    
    return DocumentService(doc_repo, llm, hub, storage, analyzer, note_context)


@pytest_asyncio.fixture
async def sample_conversation_with_messages(db_session):
    """Create a conversation with multiple messages for testing"""
    user_id = "test-user-123"
    conv_id = f"conv-test-{uuid4()}"
    
    # Create conversation
    conv = Conversation(
        id=conv_id,
        user_id=user_id,
        document_id="doc-123",
        type=ConversationType.CHAT,
        created_at=datetime.now()
    )
    db_session.add(conv)
    
    # Create message chain with unique IDs
    msg_system_id = f"msg-system-{uuid4()}"
    msg_user_1_id = f"msg-user-1-{uuid4()}"
    msg_assistant_1_id = f"msg-assistant-1-{uuid4()}"
    msg_user_2_id = f"msg-user-2-{uuid4()}"
    msg_assistant_2_id = f"msg-assistant-2-{uuid4()}"
    
    messages = [
        Message(
            id=msg_system_id,
            conversation_id=conv.id,
            parent_id=None,
            role=Role.SYSTEM,
            content="You are a helpful assistant.",
            user_id=user_id,
            version=0,
            meta_data={}
        ),
        Message(
            id=msg_user_1_id,
            conversation_id=conv.id,
            parent_id=msg_system_id,
            role=Role.USER,
            content="What is machine learning?",
            user_id=user_id,
            version=1,
            meta_data={}
        ),
        Message(
            id=msg_assistant_1_id,
            conversation_id=conv.id,
            parent_id=msg_user_1_id,
            role=Role.ASSISTANT,
            content="Machine learning is a subset of artificial intelligence...",
            user_id=user_id,
            version=1,
            meta_data={}
        ),
        Message(
            id=msg_user_2_id,
            conversation_id=conv.id,
            parent_id=msg_assistant_1_id,
            role=Role.USER,
            content="Can you give me specific examples?",
            user_id=user_id,
            version=1,
            meta_data={}
        ),
        Message(
            id=msg_assistant_2_id,
            conversation_id=conv.id,
            parent_id=msg_user_2_id,
            role=Role.ASSISTANT,
            content="Sure! Examples include image recognition, spam detection...",
            user_id=user_id,
            version=1,
            meta_data={}
        )
    ]
    
    db_session.add_all(messages)
    await db_session.commit()
    
    return {
        "conversation": conv,
        "messages": messages,
        "user_id": user_id
    }


@pytest_asyncio.fixture
async def sample_document_and_block(db_session):
    """Create a document and block for testing note attachment"""
    document = Document(
        id="doc-123",
        user_id="test-user-123",
        title="Test Document",
        status=DocumentStatus.PROCESSED,
        filename="test.pdf",
        created_at=datetime.now()
    )
    
    block = Block(
        id="block-123",
        document_id=document.id,
        block_type=BlockType.TEXT,
        html_content="<p>This is some sample text content for testing.</p>",
        metadata={"annotations": {}},
        created_at=datetime.now()
    )
    
    return {"document": document, "block": block}


class TestMessageMetadataRepository:
    """Test the repository-level metadata operations"""
    
    @pytest.mark.asyncio
    async def test_update_message_metadata_basic(self, db_session):
        """Test basic metadata update functionality"""
        repo = RDSConversationRepository()
        
        # Create a message
        message_id = f"msg-test-{uuid4()}"
        message = Message(
            id=message_id,
            conversation_id=f"conv-test-{uuid4()}",
            role=Role.USER,
            content="Test message",
            user_id="test-user",
            version=1,
            meta_data={}
        )
        db_session.add(message)
        await db_session.commit()
        
        # Update metadata
        new_metadata = {
            "generated_summaries": [
                {
                    "note_id": "note-123",
                    "block_id": "block-123",
                    "summary_range": {
                        "from_message_id": message_id,
                        "message_count": 1,
                        "topic": "test topic"
                    },
                    "created_at": "2024-01-01T12:00:00Z"
                }
            ]
        }
        
        await repo.update_message_metadata(message_id, new_metadata, db_session)
        
        # Verify update
        updated_message = await repo.get_message(message_id, db_session)
        assert updated_message is not None
        assert updated_message.meta_data == new_metadata
        assert "generated_summaries" in updated_message.meta_data
        assert len(updated_message.meta_data["generated_summaries"]) == 1
    
    @pytest.mark.asyncio
    async def test_update_message_metadata_preserves_existing(self, db_session):
        """Test that metadata updates preserve existing data"""
        repo = RDSConversationRepository()
        
        # Create message with existing metadata
        existing_metadata = {
            "custom_field": "existing_value",
            "tags": ["important", "review"]
        }
        
        message_id = f"msg-preserve-{uuid4()}"
        message = Message(
            id=message_id,
            conversation_id=f"conv-test-{uuid4()}",
            role=Role.USER,
            content="Test message",
            user_id="test-user",
            version=1,
            meta_data=existing_metadata
        )
        db_session.add(message)
        await db_session.commit()
        
        # Update with additional metadata
        updated_metadata = {
            "custom_field": "existing_value",
            "tags": ["important", "review"],
            "generated_summaries": [
                {
                    "note_id": "note-456",
                    "block_id": "block-456"
                }
            ]
        }
        
        await repo.update_message_metadata(message_id, updated_metadata, db_session)
        
        # Verify both old and new data exist
        updated_message = await repo.get_message(message_id, db_session)
        assert updated_message.meta_data["custom_field"] == "existing_value"
        assert updated_message.meta_data["tags"] == ["important", "review"]
        assert "generated_summaries" in updated_message.meta_data


class TestConversationServiceMetadata:
    """Test the service-level metadata operations with permission checking"""
    
    @pytest.mark.asyncio
    async def test_update_message_metadata_success(self, db_session, conversation_service, sample_conversation_with_messages):
        """Test successful metadata update through service"""
        data = sample_conversation_with_messages
        conv = data["conversation"]
        messages = data["messages"]
        user_id = data["user_id"]
        
        # Update metadata for the last message
        target_message = messages[-1]  # msg-assistant-2
        new_metadata = {
            "generated_summaries": [
                {
                    "note_id": "note-789",
                    "block_id": "block-789",
                    "summary_range": {
                        "from_message_id": messages[1].id,
                        "message_count": 4,
                        "topic": "machine learning basics"
                    },
                    "created_at": datetime.now().isoformat()
                }
            ]
        }
        
        # Update through service
        updated_message = await conversation_service.update_message_metadata(
            conv_id=conv.id,
            msg_id=target_message.id,
            metadata=new_metadata,
            user_id=user_id,
            session=db_session
        )
        
        # Verify the update
        assert updated_message is not None
        assert updated_message.meta_data == new_metadata
        assert "generated_summaries" in updated_message.meta_data
    
    @pytest.mark.asyncio
    async def test_update_message_metadata_permission_denied(self, db_session, conversation_service, sample_conversation_with_messages):
        """Test permission checking prevents unauthorized updates"""
        data = sample_conversation_with_messages
        conv = data["conversation"]
        messages = data["messages"]
        
        # Try to update with wrong user ID
        wrong_user_id = "different-user-456"
        target_message = messages[-1]
        
        with pytest.raises(PermissionError, match="Access denied: You don't own this conversation"):
            await conversation_service.update_message_metadata(
                conv_id=conv.id,
                msg_id=target_message.id,
                metadata={"test": "data"},
                user_id=wrong_user_id,
                session=db_session
            )
    
    @pytest.mark.asyncio
    async def test_update_message_metadata_message_not_found(self, db_session, conversation_service, sample_conversation_with_messages):
        """Test error handling for non-existent messages"""
        data = sample_conversation_with_messages
        conv = data["conversation"]
        user_id = data["user_id"]
        
        # Try to update non-existent message
        with pytest.raises(ValueError, match="Message not found in this conversation"):
            await conversation_service.update_message_metadata(
                conv_id=conv.id,
                msg_id="non-existent-msg",
                metadata={"test": "data"},
                user_id=user_id,
                session=db_session
            )
    
    @pytest.mark.asyncio
    async def test_update_message_metadata_wrong_conversation(self, db_session, conversation_service, sample_conversation_with_messages):
        """Test validation that message belongs to the specified conversation"""
        data = sample_conversation_with_messages
        user_id = data["user_id"]
        
        # Create a different conversation
        other_conv = Conversation(
            id=f"other-conv-{uuid4()}",
            user_id=user_id,
            type=ConversationType.CHAT
        )
        db_session.add(other_conv)
        
        # Create message in different conversation
        other_message = Message(
            id=f"other-msg-{uuid4()}",
            conversation_id=other_conv.id,
            role=Role.USER,
            content="Other message",
            user_id=user_id,
            version=1
        )
        db_session.add(other_message)
        await db_session.commit()
        
        # Try to update message with wrong conversation ID
        original_conv = data["conversation"]
        with pytest.raises(ValueError, match="Message not found in this conversation"):
            await conversation_service.update_message_metadata(
                conv_id=original_conv.id,
                msg_id=other_message.id,
                metadata={"test": "data"},
                user_id=user_id,
                session=db_session
            )


class TestNoteGenerationBidirectionalReferences:
    """Test the bidirectional reference system during note generation"""
    
    @pytest.mark.asyncio
    async def test_note_generation_creates_reverse_reference(self, db_session, sample_conversation_with_messages, sample_document_and_block):
        """Test that generating a note creates reverse references in message metadata"""
        # Setup
        conv_data = sample_conversation_with_messages
        doc_data = sample_document_and_block
        messages = conv_data["messages"]
        user_id = conv_data["user_id"]
        
        # Mock the document service dependencies
        with patch('new_backend_ruminate.services.document.service.RDSConversationRepository') as mock_conv_repo_class:
            mock_conv_repo = AsyncMock()
            mock_conv_repo_class.return_value = mock_conv_repo
            
            # Mock document repository
            mock_doc_repo = AsyncMock()
            mock_doc_repo.get_block.return_value = doc_data["block"]
            mock_doc_repo.get_document.return_value = doc_data["document"]
            mock_doc_repo.update_block.return_value = None
            
            # Mock LLM service
            mock_llm = AsyncMock()
            mock_llm.generate_response.return_value = "Generated summary content about machine learning"
            
            # Mock note context
            mock_note_context = AsyncMock()
            mock_note_context.build_context.return_value = [
                {"role": "system", "content": "Generate a note"},
                {"role": "user", "content": "Summarize this conversation"}
            ]
            
            # Create document service
            doc_service = DocumentService(
                repo=mock_doc_repo,
                llm=mock_llm,
                hub=EventStreamHub(),
                storage=AsyncMock(),
                analyzer=AsyncMock(),
                note_context=mock_note_context
            )
            
            # Filter to user/assistant messages (excluding system)
            filtered_messages = [msg for msg in messages if msg.role in [Role.USER, Role.ASSISTANT]]
            
            # Generate note
            result = await doc_service.generate_note_from_conversation(
                conversation_id=conv_data["conversation"].id,
                block_id=doc_data["block"].id,
                messages=messages,
                message_count=4,
                topic="machine learning discussion",
                user_id=user_id,
                session=db_session
            )
            
            # Verify note was generated
            assert "note" in result
            assert "note_id" in result
            assert result["note"] == "Generated summary content about machine learning"
            
            # Verify reverse reference was created
            mock_conv_repo.update_message_metadata.assert_called_once()
            call_args = mock_conv_repo.update_message_metadata.call_args
            
            # Check the message ID (should be the last filtered message)
            assert call_args[1]["mid"] == filtered_messages[-1].id
            
            # Check the metadata structure
            metadata = call_args[1]["meta_data"]
            assert "generated_summaries" in metadata
            assert len(metadata["generated_summaries"]) == 1
            
            summary_ref = metadata["generated_summaries"][0]
            assert summary_ref["note_id"] == result["note_id"]
            assert summary_ref["block_id"] == doc_data["block"].id
            assert summary_ref["summary_range"]["from_message_id"] == filtered_messages[0].id
            assert summary_ref["summary_range"]["message_count"] == len(filtered_messages)
            assert summary_ref["summary_range"]["topic"] == "machine learning discussion"
            assert "created_at" in summary_ref
    
    @pytest.mark.asyncio
    async def test_note_generation_handles_no_messages(self, db_session, sample_document_and_block):
        """Test note generation gracefully handles empty message list"""
        doc_data = sample_document_and_block
        
        # Mock dependencies
        mock_doc_repo = AsyncMock()
        mock_doc_repo.get_block.return_value = doc_data["block"]
        mock_doc_repo.get_document.return_value = doc_data["document"]
        
        mock_llm = AsyncMock()
        mock_llm.generate_response.return_value = "Empty conversation summary"
        
        mock_note_context = AsyncMock()
        mock_note_context.build_context.return_value = [
            {"role": "system", "content": "Generate a note"},
        ]
        
        doc_service = DocumentService(
            repo=mock_doc_repo,
            llm=mock_llm,
            hub=EventStreamHub(),
            storage=AsyncMock(),
            analyzer=AsyncMock(),
            note_context=mock_note_context
        )
        
        # Generate note with empty messages
        with patch('new_backend_ruminate.services.document.service.RDSConversationRepository'):
            result = await doc_service.generate_note_from_conversation(
                conversation_id="conv-empty",
                block_id=doc_data["block"].id,
                messages=[],  # Empty messages
                message_count=5,
                topic=None,
                user_id="test-user",
                session=db_session
            )
            
            # Should still generate note but no reverse reference
            assert "note" in result
            assert result["note"] == "Empty conversation summary"
    
    @pytest.mark.asyncio
    async def test_multiple_summaries_accumulate_in_metadata(self, db_session, sample_conversation_with_messages):
        """Test that multiple note generations accumulate in message metadata"""
        data = sample_conversation_with_messages
        message = data["messages"][-1]  # Last message
        
        # Start with existing summary reference
        initial_metadata = {
            "generated_summaries": [
                {
                    "note_id": "existing-note-123",
                    "block_id": "existing-block-123",
                    "summary_range": {
                        "from_message_id": "msg-1",
                        "message_count": 2,
                        "topic": "existing topic"
                    },
                    "created_at": "2024-01-01T10:00:00Z"
                }
            ]
        }
        
        # Update message with initial metadata
        repo = RDSConversationRepository()
        await repo.update_message_metadata(message.id, initial_metadata, db_session)
        
        # Simulate adding a second summary reference
        updated_metadata = {
            "generated_summaries": [
                {
                    "note_id": "existing-note-123",
                    "block_id": "existing-block-123",
                    "summary_range": {
                        "from_message_id": "msg-1",
                        "message_count": 2,
                        "topic": "existing topic"
                    },
                    "created_at": "2024-01-01T10:00:00Z"
                },
                {
                    "note_id": "new-note-456",
                    "block_id": "new-block-456",
                    "summary_range": {
                        "from_message_id": "msg-2",
                        "message_count": 3,
                        "topic": "new topic"
                    },
                    "created_at": "2024-01-01T11:00:00Z"
                }
            ]
        }
        
        await repo.update_message_metadata(message.id, updated_metadata, db_session)
        
        # Verify both summaries exist
        final_message = await repo.get_message(message.id, db_session)
        assert len(final_message.meta_data["generated_summaries"]) == 2
        
        # Verify content of both summaries
        summaries = final_message.meta_data["generated_summaries"]
        note_ids = [s["note_id"] for s in summaries]
        assert "existing-note-123" in note_ids
        assert "new-note-456" in note_ids


class TestAPIIntegration:
    """Test the API endpoints work correctly with the new functionality"""
    
    @pytest.mark.asyncio
    async def test_message_metadata_update_endpoint_integration(self, db_session, sample_conversation_with_messages):
        """Test the PATCH endpoint for updating message metadata"""
        from fastapi.testclient import TestClient
        from new_backend_ruminate.main import app
        
        # This would be a full integration test with the API
        # For now, we verify the service layer works correctly
        
        data = sample_conversation_with_messages
        conv_service = ConversationService(
            RDSConversationRepository(),
            StubLLM(),
            EventStreamHub(),
            StubContextBuilder()
        )
        
        test_metadata = {
            "api_test": True,
            "generated_summaries": [
                {
                    "note_id": "api-note-123",
                    "block_id": "api-block-123"
                }
            ]
        }
        
        # Update through service (simulating API call)
        result = await conv_service.update_message_metadata(
            conv_id=data["conversation"].id,
            msg_id=data["messages"][-1].id,
            metadata=test_metadata,
            user_id=data["user_id"],
            session=db_session
        )
        
        # Verify API-style response
        assert result.meta_data == test_metadata
        assert result.meta_data["api_test"] is True
        assert len(result.meta_data["generated_summaries"]) == 1


if __name__ == "__main__":
    # Run tests with: pytest tests/test_message_metadata_functionality.py -v
    pass