import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, call
from uuid import uuid4
from datetime import datetime

from new_backend_ruminate.domain.document.entities.text_enhancement import TextEnhancement, TextEnhancementType
from new_backend_ruminate.services.document.text_enhancement_service import TextEnhancementService
from new_backend_ruminate.domain.ports.llm import LLMService


@pytest.fixture
def mock_repo():
    """Create a mock repository"""
    return AsyncMock()


@pytest.fixture
def mock_llm():
    """Create a mock LLM service"""
    return AsyncMock(spec=LLMService)


@pytest.fixture
def text_enhancement_service(mock_repo, mock_llm):
    """Create service with mocked dependencies"""
    return TextEnhancementService(mock_repo, mock_llm)


@pytest.fixture
def mock_session():
    """Create a mock database session"""
    return MagicMock()


class TestTextEnhancementService:
    """Unit tests for TextEnhancementService"""
    
    @pytest.mark.asyncio
    async def test_get_all_for_document(self, text_enhancement_service, mock_repo, mock_session):
        """Test getting all text enhancements for a document"""
        # Setup mock data
        doc_id = "doc-123"
        user_id = "user-456"
        
        mock_enhancements = {
            "definitions": [
                TextEnhancement(
                    id="def-1",
                    type=TextEnhancementType.DEFINITION,
                    document_id=doc_id,
                    block_id="block-1",
                    user_id=user_id,
                    text="term1",
                    text_start_offset=0,
                    text_end_offset=5,
                    data={"term": "term1", "definition": "def1"}
                )
            ],
            "annotations": [
                TextEnhancement(
                    id="ann-1",
                    type=TextEnhancementType.ANNOTATION,
                    document_id=doc_id,
                    block_id="block-2",
                    user_id=user_id,
                    text="note",
                    text_start_offset=10,
                    text_end_offset=14,
                    data={"note": "important"}
                )
            ],
            "rabbitholes": [
                TextEnhancement(
                    id="rab-1",
                    type=TextEnhancementType.RABBITHOLE,
                    document_id=doc_id,
                    block_id="block-3",
                    user_id=user_id,
                    text="dive",
                    text_start_offset=20,
                    text_end_offset=24,
                    data={"conversation_id": "conv-1"}
                )
            ]
        }
        
        mock_repo.get_all_for_document_grouped.return_value = mock_enhancements
        
        # Call service
        result = await text_enhancement_service.get_all_for_document(doc_id, user_id, mock_session)
        
        # Verify
        mock_repo.get_all_for_document_grouped.assert_called_once_with(doc_id, mock_session)
        
        assert len(result["definitions"]) == 1
        assert result["definitions"][0]["id"] == "def-1"
        assert result["definitions"][0]["type"] == "DEFINITION"
        
        assert len(result["annotations"]) == 1
        assert result["annotations"][0]["id"] == "ann-1"
        assert result["annotations"][0]["type"] == "ANNOTATION"
        
        assert len(result["rabbitholes"]) == 1
        assert result["rabbitholes"][0]["id"] == "rab-1"
        assert result["rabbitholes"][0]["type"] == "RABBITHOLE"
    
    @pytest.mark.asyncio
    async def test_create_definition_new(self, text_enhancement_service, mock_repo, mock_llm, mock_session):
        """Test creating a new definition"""
        # Setup
        doc_id = "doc-123"
        block_id = "block-456"
        user_id = "user-789"
        term = "quantum physics"
        start_offset = 100
        end_offset = 115
        context = "In quantum physics, particles behave in strange ways"
        
        # Mock no existing definition
        mock_repo.find_by_position.return_value = None
        
        # Mock LLM response
        mock_llm.generate_response.return_value = "The branch of physics dealing with atomic and subatomic particles"
        
        # Mock repository create
        created_enhancement = TextEnhancement(
            id="new-def-id",
            type=TextEnhancementType.DEFINITION,
            document_id=doc_id,
            block_id=block_id,
            user_id=user_id,
            text=term,
            text_start_offset=start_offset,
            text_end_offset=end_offset,
            data={
                "term": term,
                "definition": "The branch of physics dealing with atomic and subatomic particles",
                "context": context
            }
        )
        mock_repo.create.return_value = created_enhancement
        
        # Call service
        result = await text_enhancement_service.create_definition(
            doc_id, block_id, term, start_offset, end_offset, context, user_id, mock_session
        )
        
        # Verify
        mock_repo.find_by_position.assert_called_once_with(
            block_id, start_offset, end_offset, TextEnhancementType.DEFINITION, mock_session
        )
        
        # Check LLM was called
        mock_llm.generate_response.assert_called_once()
        messages = mock_llm.generate_response.call_args[0][0]
        assert len(messages) == 1
        assert "quantum physics" in messages[0]["content"]
        assert context in messages[0]["content"]
        
        # Check repository create was called
        mock_repo.create.assert_called_once()
        created_arg = mock_repo.create.call_args[0][0]
        assert created_arg.type == TextEnhancementType.DEFINITION
        assert created_arg.text == term
        assert created_arg.data["definition"] == "The branch of physics dealing with atomic and subatomic particles"
        
        assert result == created_enhancement
    
    @pytest.mark.asyncio
    async def test_create_definition_existing(self, text_enhancement_service, mock_repo, mock_session):
        """Test that existing definition is returned without creating new one"""
        # Setup existing definition
        existing = TextEnhancement(
            id="existing-def",
            type=TextEnhancementType.DEFINITION,
            document_id="doc-123",
            block_id="block-456",
            user_id="user-789",
            text="existing term",
            text_start_offset=50,
            text_end_offset=63,
            data={"term": "existing term", "definition": "existing definition"}
        )
        
        mock_repo.find_by_position.return_value = existing
        
        # Call service
        result = await text_enhancement_service.create_definition(
            "doc-123", "block-456", "existing term", 50, 63, None, "user-789", mock_session
        )
        
        # Verify no create was called
        mock_repo.create.assert_not_called()
        assert result == existing
    
    @pytest.mark.asyncio
    async def test_create_annotation_new(self, text_enhancement_service, mock_repo, mock_session):
        """Test creating a new annotation"""
        # Setup
        doc_id = "doc-123"
        block_id = "block-456"
        user_id = "user-789"
        text = "important text"
        note = "This is very important!"
        start_offset = 200
        end_offset = 214
        
        # Mock no existing annotation
        mock_repo.find_by_position.return_value = None
        
        # Mock repository create
        created_annotation = TextEnhancement(
            id="new-ann-id",
            type=TextEnhancementType.ANNOTATION,
            document_id=doc_id,
            block_id=block_id,
            user_id=user_id,
            text=text,
            text_start_offset=start_offset,
            text_end_offset=end_offset,
            data={"note": note}
        )
        mock_repo.create.return_value = created_annotation
        
        # Call service
        result = await text_enhancement_service.create_annotation(
            doc_id, block_id, text, note, start_offset, end_offset, user_id, mock_session
        )
        
        # Verify
        mock_repo.find_by_position.assert_called_once_with(
            block_id, start_offset, end_offset, TextEnhancementType.ANNOTATION, mock_session
        )
        
        mock_repo.create.assert_called_once()
        created_arg = mock_repo.create.call_args[0][0]
        assert created_arg.type == TextEnhancementType.ANNOTATION
        assert created_arg.text == text
        assert created_arg.data["note"] == note
        
        assert result == created_annotation
    
    @pytest.mark.asyncio
    async def test_update_annotation_existing(self, text_enhancement_service, mock_repo, mock_session):
        """Test updating an existing annotation"""
        # Setup existing annotation
        existing = TextEnhancement(
            id="existing-ann",
            type=TextEnhancementType.ANNOTATION,
            document_id="doc-123",
            block_id="block-456",
            user_id="user-789",
            text="old text",
            text_start_offset=100,
            text_end_offset=108,
            data={"note": "old note"}
        )
        
        mock_repo.find_by_position.return_value = existing
        
        # Mock update
        updated = TextEnhancement(
            id="existing-ann",
            type=TextEnhancementType.ANNOTATION,
            document_id="doc-123",
            block_id="block-456",
            user_id="user-789",
            text="new text",
            text_start_offset=100,
            text_end_offset=108,
            data={"note": "new note"}
        )
        mock_repo.update.return_value = updated
        
        # Call service
        result = await text_enhancement_service.create_annotation(
            "doc-123", "block-456", "new text", "new note", 100, 108, "user-789", mock_session
        )
        
        # Verify update was called
        mock_repo.update.assert_called_once_with(
            "existing-ann",
            {"data": {"note": "new note"}, "text": "new text"},
            mock_session
        )
        assert result == updated
    
    @pytest.mark.asyncio
    async def test_delete_annotation_with_empty_note(self, text_enhancement_service, mock_repo, mock_session):
        """Test that annotation is deleted when note is empty string"""
        # Setup existing annotation
        existing = TextEnhancement(
            id="existing-ann",
            type=TextEnhancementType.ANNOTATION,
            document_id="doc-123",
            block_id="block-456",
            user_id="user-789",
            text="text",
            text_start_offset=100,
            text_end_offset=104,
            data={"note": "will be deleted"}
        )
        
        mock_repo.find_by_position.return_value = existing
        mock_repo.delete.return_value = True
        
        # Call service with empty note
        result = await text_enhancement_service.create_annotation(
            "doc-123", "block-456", "text", "", 100, 104, "user-789", mock_session
        )
        
        # Verify delete was called
        mock_repo.delete.assert_called_once_with("existing-ann", mock_session)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_create_rabbithole_enhancement(self, text_enhancement_service, mock_repo, mock_session):
        """Test creating a rabbithole enhancement"""
        # Setup
        conv_id = "conv-123"
        doc_id = "doc-456"
        block_id = "block-789"
        user_id = "user-000"
        text = "deep dive text"
        start_offset = 300
        end_offset = 314
        
        # Mock repository create
        created_rabbithole = TextEnhancement(
            id="new-rab-id",
            type=TextEnhancementType.RABBITHOLE,
            document_id=doc_id,
            block_id=block_id,
            user_id=user_id,
            text=text,
            text_start_offset=start_offset,
            text_end_offset=end_offset,
            data={"conversation_id": conv_id}
        )
        mock_repo.create.return_value = created_rabbithole
        
        # Call service
        result = await text_enhancement_service.create_rabbithole_enhancement(
            conv_id, doc_id, block_id, text, start_offset, end_offset, user_id, mock_session
        )
        
        # Verify
        mock_repo.create.assert_called_once()
        created_arg = mock_repo.create.call_args[0][0]
        assert created_arg.type == TextEnhancementType.RABBITHOLE
        assert created_arg.text == text
        assert created_arg.data["conversation_id"] == conv_id
        
        assert result == created_rabbithole
    
    @pytest.mark.asyncio
    async def test_delete_enhancement(self, text_enhancement_service, mock_repo, mock_session):
        """Test deleting an enhancement"""
        enhancement_id = "enh-to-delete"
        user_id = "user-123"
        
        mock_repo.delete.return_value = True
        
        # Call service
        result = await text_enhancement_service.delete_enhancement(enhancement_id, user_id, mock_session)
        
        # Verify
        mock_repo.delete.assert_called_once_with(enhancement_id, mock_session)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_generate_definition_with_context(self, text_enhancement_service, mock_llm):
        """Test that definition generation uses context properly"""
        term = "entropy"
        context = "In thermodynamics, entropy is a measure of disorder"
        
        mock_llm.generate_response.return_value = "A measure of disorder or randomness in a system"
        
        # Call the private method directly
        result = await text_enhancement_service._generate_definition(term, context)
        
        # Verify LLM was called with proper prompt
        mock_llm.generate_response.assert_called_once()
        messages = mock_llm.generate_response.call_args[0][0]
        assert len(messages) == 1
        assert "entropy" in messages[0]["content"]
        assert context in messages[0]["content"]
        assert "contextual definition" in messages[0]["content"]
        
        assert result == "A measure of disorder or randomness in a system"
    
    @pytest.mark.asyncio
    async def test_generate_definition_without_context(self, text_enhancement_service, mock_llm):
        """Test that definition generation works without context"""
        term = "photosynthesis"
        
        mock_llm.generate_response.return_value = "The process by which plants convert light energy to chemical energy"
        
        # Call the private method directly
        result = await text_enhancement_service._generate_definition(term, None)
        
        # Verify LLM was called with proper prompt
        mock_llm.generate_response.assert_called_once()
        messages = mock_llm.generate_response.call_args[0][0]
        assert len(messages) == 1
        assert "photosynthesis" in messages[0]["content"]
        assert "general definition" in messages[0]["content"]
        
        assert result == "The process by which plants convert light energy to chemical energy"