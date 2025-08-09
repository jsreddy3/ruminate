import pytest
from datetime import datetime
from new_backend_ruminate.domain.document.entities.text_enhancement import TextEnhancement, TextEnhancementType


class TestTextEnhancementEntity:
    """Unit tests for TextEnhancement domain entity"""
    
    def test_create_definition_enhancement(self):
        """Test creating a definition text enhancement"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.DEFINITION,
            document_id="doc-123",
            block_id="block-456",
            user_id="user-789",
            text="quantum mechanics",
            text_start_offset=100,
            text_end_offset=117,
            data={
                "term": "quantum mechanics",
                "definition": "The branch of physics dealing with atomic and subatomic particles",
                "context": "In quantum mechanics, particles can exist in multiple states"
            }
        )
        
        assert enhancement.type == TextEnhancementType.DEFINITION
        assert enhancement.text == "quantum mechanics"
        assert enhancement.get_term() == "quantum mechanics"
        assert enhancement.get_definition() == "The branch of physics dealing with atomic and subatomic particles"
        assert enhancement.get_note() is None  # Should be None for definitions
        assert enhancement.get_conversation_id() is None
        assert enhancement.is_definition is True
        assert enhancement.is_annotation is False
        assert enhancement.is_rabbithole is False
    
    def test_create_annotation_enhancement(self):
        """Test creating an annotation text enhancement"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.ANNOTATION,
            document_id="doc-123",
            block_id="block-456", 
            user_id="user-789",
            text="important finding",
            text_start_offset=200,
            text_end_offset=217,
            data={
                "note": "This contradicts the previous hypothesis"
            }
        )
        
        assert enhancement.type == TextEnhancementType.ANNOTATION
        assert enhancement.get_note() == "This contradicts the previous hypothesis"
        assert enhancement.get_term() is None
        assert enhancement.get_definition() is None
        assert enhancement.get_conversation_id() is None
        assert enhancement.is_annotation is True
        assert enhancement.is_definition is False
        assert enhancement.is_rabbithole is False
    
    def test_create_rabbithole_enhancement(self):
        """Test creating a rabbithole text enhancement"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.RABBITHOLE,
            document_id="doc-123",
            block_id="block-456",
            user_id="user-789",
            text="complex theorem",
            text_start_offset=300,
            text_end_offset=315,
            data={
                "conversation_id": "conv-abc-def"
            }
        )
        
        assert enhancement.type == TextEnhancementType.RABBITHOLE
        assert enhancement.get_conversation_id() == "conv-abc-def"
        assert enhancement.get_term() is None
        assert enhancement.get_definition() is None
        assert enhancement.get_note() is None
        assert enhancement.is_rabbithole is True
        assert enhancement.is_definition is False
        assert enhancement.is_annotation is False
    
    def test_to_dict_conversion(self):
        """Test converting enhancement to dictionary"""
        created_at = datetime.now()
        enhancement = TextEnhancement(
            id="test-id",
            type=TextEnhancementType.DEFINITION,
            document_id="doc-123",
            block_id="block-456",
            user_id="user-789",
            text="test term",
            text_start_offset=0,
            text_end_offset=9,
            data={"term": "test term", "definition": "test def"},
            created_at=created_at,
            updated_at=created_at
        )
        
        result = enhancement.to_dict()
        
        assert result["id"] == "test-id"
        assert result["type"] == "DEFINITION"
        assert result["document_id"] == "doc-123"
        assert result["block_id"] == "block-456"
        assert result["user_id"] == "user-789"
        assert result["text"] == "test term"
        assert result["text_start_offset"] == 0
        assert result["text_end_offset"] == 9
        assert result["data"]["term"] == "test term"
        assert result["data"]["definition"] == "test def"
        assert result["created_at"] == created_at.isoformat()
        assert result["updated_at"] == created_at.isoformat()
    
    def test_from_dict_conversion(self):
        """Test creating enhancement from dictionary"""
        data = {
            "id": "test-id",
            "type": "ANNOTATION",
            "document_id": "doc-123",
            "block_id": "block-456",
            "user_id": "user-789",
            "text": "annotated text",
            "text_start_offset": 50,
            "text_end_offset": 64,
            "data": {"note": "Important note"},
            "created_at": "2024-01-01T12:00:00",
            "updated_at": "2024-01-01T12:00:00"
        }
        
        enhancement = TextEnhancement.from_dict(data)
        
        assert enhancement.id == "test-id"
        assert enhancement.type == TextEnhancementType.ANNOTATION
        assert enhancement.document_id == "doc-123"
        assert enhancement.block_id == "block-456"
        assert enhancement.user_id == "user-789"
        assert enhancement.text == "annotated text"
        assert enhancement.text_start_offset == 50
        assert enhancement.text_end_offset == 64
        assert enhancement.get_note() == "Important note"
        assert isinstance(enhancement.created_at, datetime)
        assert isinstance(enhancement.updated_at, datetime)
    
    def test_default_values(self):
        """Test that default values are set correctly"""
        enhancement = TextEnhancement()
        
        assert enhancement.id is not None  # UUID should be generated
        assert enhancement.type == TextEnhancementType.DEFINITION  # Default type
        assert enhancement.document_id == ""
        assert enhancement.block_id == ""
        assert enhancement.user_id == ""
        assert enhancement.text == ""
        assert enhancement.text_start_offset == 0
        assert enhancement.text_end_offset == 0
        assert enhancement.data == {}
        assert isinstance(enhancement.created_at, datetime)
        assert isinstance(enhancement.updated_at, datetime)