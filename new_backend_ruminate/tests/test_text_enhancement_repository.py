import pytest
import pytest_asyncio
from uuid import uuid4
from datetime import datetime

from new_backend_ruminate.domain.document.entities.text_enhancement import TextEnhancement, TextEnhancementType
from new_backend_ruminate.infrastructure.document.rds_text_enhancement_repository import RDSTextEnhancementRepository
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.infrastructure.user.models import UserModel
from new_backend_ruminate.domain.document.entities.document import Document
from new_backend_ruminate.infrastructure.document.models import DocumentModel, BlockModel


@pytest_asyncio.fixture
async def test_user(db_session):
    """Create a test user"""
    user_id = str(uuid4())
    user_model = UserModel(
        id=user_id,
        google_id=f"google-{user_id}",
        email=f"test-{user_id}@example.com",
        name="Test User"
    )
    db_session.add(user_model)
    await db_session.flush()
    return User.from_dict({
        "id": user_model.id,
        "google_id": user_model.google_id,
        "email": user_model.email,
        "name": user_model.name
    })


@pytest_asyncio.fixture
async def test_document(db_session, test_user):
    """Create a test document"""
    doc_model = DocumentModel(
        id=str(uuid4()),
        user_id=test_user.id,
        title="Test Document",
        status="READY"
    )
    db_session.add(doc_model)
    await db_session.flush()
    return Document.from_dict({
        "id": doc_model.id,
        "user_id": doc_model.user_id,
        "title": doc_model.title,
        "status": doc_model.status
    })


@pytest_asyncio.fixture
async def test_block(db_session, test_document):
    """Create a test block"""
    block_model = BlockModel(
        id=str(uuid4()),
        document_id=test_document.id,
        block_type="Text",
        html_content="<p>This is a test block with quantum mechanics and other content.</p>",
        page_number=1
    )
    db_session.add(block_model)
    await db_session.flush()
    return block_model


@pytest.fixture
def text_enhancement_repo():
    """Create repository instance"""
    return RDSTextEnhancementRepository()


class TestTextEnhancementRepository:
    """Integration tests for TextEnhancementRepository"""
    
    @pytest.mark.asyncio
    async def test_create_enhancement(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test creating a text enhancement"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.DEFINITION,
            document_id=test_document.id,
            block_id=test_block.id,
            user_id=test_user.id,
            text="quantum mechanics",
            text_start_offset=28,
            text_end_offset=45,
            data={
                "term": "quantum mechanics",
                "definition": "The branch of physics dealing with atomic particles"
            }
        )
        
        created = await text_enhancement_repo.create(enhancement, db_session)
        
        assert created.id == enhancement.id
        assert created.type == TextEnhancementType.DEFINITION
        assert created.document_id == test_document.id
        assert created.block_id == test_block.id
        assert created.user_id == test_user.id
        assert created.text == "quantum mechanics"
        assert created.text_start_offset == 28
        assert created.text_end_offset == 45
        assert created.data["term"] == "quantum mechanics"
        assert created.data["definition"] == "The branch of physics dealing with atomic particles"
    
    @pytest.mark.asyncio
    async def test_get_enhancement_by_id(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test retrieving enhancement by ID"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.ANNOTATION,
            document_id=test_document.id,
            block_id=test_block.id,
            user_id=test_user.id,
            text="important",
            text_start_offset=10,
            text_end_offset=19,
            data={"note": "This is very important"}
        )
        
        created = await text_enhancement_repo.create(enhancement, db_session)
        retrieved = await text_enhancement_repo.get(created.id, db_session)
        
        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.type == TextEnhancementType.ANNOTATION
        assert retrieved.get_note() == "This is very important"
    
    @pytest.mark.asyncio
    async def test_get_enhancements_by_document(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test retrieving all enhancements for a document"""
        # Create multiple enhancements
        enhancements = [
            TextEnhancement(
                type=TextEnhancementType.DEFINITION,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="term1",
                text_start_offset=0,
                text_end_offset=5,
                data={"term": "term1", "definition": "def1"}
            ),
            TextEnhancement(
                type=TextEnhancementType.ANNOTATION,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="note text",
                text_start_offset=20,
                text_end_offset=29,
                data={"note": "Important note"}
            ),
            TextEnhancement(
                type=TextEnhancementType.RABBITHOLE,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="deep dive",
                text_start_offset=40,
                text_end_offset=49,
                data={"conversation_id": "conv-123"}
            )
        ]
        
        for e in enhancements:
            await text_enhancement_repo.create(e, db_session)
        
        # Retrieve all
        results = await text_enhancement_repo.get_by_document(test_document.id, db_session)
        
        assert len(results) == 3
        assert results[0].text_start_offset == 0  # Should be ordered by position
        assert results[1].text_start_offset == 20
        assert results[2].text_start_offset == 40
    
    @pytest.mark.asyncio
    async def test_get_enhancements_by_block(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test retrieving enhancements for a specific block"""
        # Create another block
        other_block = BlockModel(
            id=str(uuid4()),
            document_id=test_document.id,
            block_type="Text",
            html_content="<p>Other block</p>"
        )
        db_session.add(other_block)
        await db_session.flush()
        
        # Create enhancements for both blocks
        await text_enhancement_repo.create(
            TextEnhancement(
                type=TextEnhancementType.DEFINITION,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="term1",
                text_start_offset=0,
                text_end_offset=5,
                data={"term": "term1", "definition": "def1"}
            ),
            db_session
        )
        
        await text_enhancement_repo.create(
            TextEnhancement(
                type=TextEnhancementType.DEFINITION,
                document_id=test_document.id,
                block_id=other_block.id,
                user_id=test_user.id,
                text="term2",
                text_start_offset=0,
                text_end_offset=5,
                data={"term": "term2", "definition": "def2"}
            ),
            db_session
        )
        
        # Get only for test_block
        results = await text_enhancement_repo.get_by_block(test_block.id, db_session)
        
        assert len(results) == 1
        assert results[0].block_id == test_block.id
        assert results[0].text == "term1"
    
    @pytest.mark.asyncio
    async def test_get_by_type(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test filtering enhancements by type"""
        # Create different types
        await text_enhancement_repo.create(
            TextEnhancement(
                type=TextEnhancementType.DEFINITION,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="def",
                text_start_offset=0,
                text_end_offset=3,
                data={"term": "def", "definition": "definition"}
            ),
            db_session
        )
        
        await text_enhancement_repo.create(
            TextEnhancement(
                type=TextEnhancementType.ANNOTATION,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="ann",
                text_start_offset=10,
                text_end_offset=13,
                data={"note": "annotation"}
            ),
            db_session
        )
        
        # Get only definitions
        definitions = await text_enhancement_repo.get_by_type(
            test_document.id, TextEnhancementType.DEFINITION, db_session
        )
        
        assert len(definitions) == 1
        assert definitions[0].type == TextEnhancementType.DEFINITION
        assert definitions[0].text == "def"
    
    @pytest.mark.asyncio
    async def test_update_enhancement(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test updating an enhancement"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.ANNOTATION,
            document_id=test_document.id,
            block_id=test_block.id,
            user_id=test_user.id,
            text="original",
            text_start_offset=0,
            text_end_offset=8,
            data={"note": "Original note"}
        )
        
        created = await text_enhancement_repo.create(enhancement, db_session)
        
        # Update the note
        updated = await text_enhancement_repo.update(
            created.id,
            {"data": {"note": "Updated note"}},
            db_session
        )
        
        assert updated is not None
        assert updated.id == created.id
        assert updated.get_note() == "Updated note"
        assert updated.text == "original"  # Text should not change
    
    @pytest.mark.asyncio
    async def test_delete_enhancement(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test deleting an enhancement"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.RABBITHOLE,
            document_id=test_document.id,
            block_id=test_block.id,
            user_id=test_user.id,
            text="delete me",
            text_start_offset=0,
            text_end_offset=9,
            data={"conversation_id": "conv-to-delete"}
        )
        
        created = await text_enhancement_repo.create(enhancement, db_session)
        
        # Delete it
        success = await text_enhancement_repo.delete(created.id, db_session)
        assert success is True
        
        # Verify it's gone
        retrieved = await text_enhancement_repo.get(created.id, db_session)
        assert retrieved is None
    
    @pytest.mark.asyncio
    async def test_find_by_position(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test finding enhancement by position"""
        enhancement = TextEnhancement(
            type=TextEnhancementType.DEFINITION,
            document_id=test_document.id,
            block_id=test_block.id,
            user_id=test_user.id,
            text="positioned",
            text_start_offset=100,
            text_end_offset=110,
            data={"term": "positioned", "definition": "at specific location"}
        )
        
        await text_enhancement_repo.create(enhancement, db_session)
        
        # Find by exact position
        found = await text_enhancement_repo.find_by_position(
            test_block.id, 100, 110, TextEnhancementType.DEFINITION, db_session
        )
        
        assert found is not None
        assert found.text == "positioned"
        assert found.text_start_offset == 100
        assert found.text_end_offset == 110
        
        # Should not find with wrong position
        not_found = await text_enhancement_repo.find_by_position(
            test_block.id, 100, 111, TextEnhancementType.DEFINITION, db_session
        )
        assert not_found is None
        
        # Should not find with wrong type
        wrong_type = await text_enhancement_repo.find_by_position(
            test_block.id, 100, 110, TextEnhancementType.ANNOTATION, db_session
        )
        assert wrong_type is None
    
    @pytest.mark.asyncio
    async def test_get_all_grouped(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test getting all enhancements grouped by type"""
        # Create one of each type
        await text_enhancement_repo.create(
            TextEnhancement(
                type=TextEnhancementType.DEFINITION,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="def1",
                text_start_offset=0,
                text_end_offset=4,
                data={"term": "def1", "definition": "definition 1"}
            ),
            db_session
        )
        
        await text_enhancement_repo.create(
            TextEnhancement(
                type=TextEnhancementType.DEFINITION,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="def2",
                text_start_offset=10,
                text_end_offset=14,
                data={"term": "def2", "definition": "definition 2"}
            ),
            db_session
        )
        
        await text_enhancement_repo.create(
            TextEnhancement(
                type=TextEnhancementType.ANNOTATION,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="note",
                text_start_offset=20,
                text_end_offset=24,
                data={"note": "annotation 1"}
            ),
            db_session
        )
        
        await text_enhancement_repo.create(
            TextEnhancement(
                type=TextEnhancementType.RABBITHOLE,
                document_id=test_document.id,
                block_id=test_block.id,
                user_id=test_user.id,
                text="rabbit",
                text_start_offset=30,
                text_end_offset=36,
                data={"conversation_id": "conv-1"}
            ),
            db_session
        )
        
        # Get grouped
        grouped = await text_enhancement_repo.get_all_for_document_grouped(test_document.id, db_session)
        
        assert len(grouped["definitions"]) == 2
        assert len(grouped["annotations"]) == 1
        assert len(grouped["rabbitholes"]) == 1
        
        assert grouped["definitions"][0].text == "def1"
        assert grouped["definitions"][1].text == "def2"
        assert grouped["annotations"][0].text == "note"
        assert grouped["rabbitholes"][0].text == "rabbit"
    
    @pytest.mark.asyncio
    async def test_unique_constraint_violation(self, db_session, text_enhancement_repo, test_user, test_document, test_block):
        """Test that unique constraint prevents duplicate enhancements at same position"""
        enhancement1 = TextEnhancement(
            type=TextEnhancementType.DEFINITION,
            document_id=test_document.id,
            block_id=test_block.id,
            user_id=test_user.id,
            text="unique",
            text_start_offset=50,
            text_end_offset=56,
            data={"term": "unique", "definition": "first"}
        )
        
        await text_enhancement_repo.create(enhancement1, db_session)
        
        # Try to create another at same position with same type
        enhancement2 = TextEnhancement(
            type=TextEnhancementType.DEFINITION,
            document_id=test_document.id,
            block_id=test_block.id,
            user_id=test_user.id,
            text="unique",
            text_start_offset=50,
            text_end_offset=56,
            data={"term": "unique", "definition": "second"}
        )
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            await text_enhancement_repo.create(enhancement2, db_session)
            
        # Rollback after the expected error to clean up the session
        await db_session.rollback()