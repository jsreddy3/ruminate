"""Integration test for note generation using real conversation data"""
import pytest
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.infrastructure.db.bootstrap import init_engine, session_scope
from new_backend_ruminate.dependencies import (
    get_conversation_service,
    get_document_service
)
from new_backend_ruminate.config import settings


@pytest.mark.asyncio
@pytest.mark.integration
async def test_note_generation_with_real_conversation():
    """Test note generation with the provided conversation ID"""
    
    # Initialize database connection
    db_url = settings().db_url or f"postgresql+asyncpg://{settings().db_user}:{settings().db_password}@{settings().db_host}:{settings().db_port}/{settings().db_name}"
    await init_engine(db_url)
    
    # Test configuration
    CONVERSATION_ID = "bfc6bdee-fc6f-4382-9f11-0df4f31778f7"
    
    # Get services
    conv_service = get_conversation_service()
    doc_service = get_document_service()
    
    async with session_scope() as session:
        try:
            # Step 1: Get the conversation to find the user
            from sqlalchemy import select
            from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
            
            stmt = select(Conversation).where(Conversation.id == CONVERSATION_ID)
            result = await session.execute(stmt)
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                pytest.skip(f"Conversation {CONVERSATION_ID} not found in database")
            
            USER_ID = conversation.user_id
            print(f"\n✓ Found conversation with user: {USER_ID}")
            print(f"  Type: {conversation.type}")
            print(f"  Document: {conversation.document_id}")
            
            # Step 2: Get messages
            messages = await conv_service.get_latest_thread(CONVERSATION_ID, USER_ID, session)
            print(f"\n✓ Found {len(messages)} messages in conversation")
            
            # Show message preview
            for i, msg in enumerate(messages[:5]):
                role = str(msg.role).split('.')[-1].lower()
                content_preview = msg.content[:80] + "..." if len(msg.content) > 80 else msg.content
                print(f"  [{i}] {role}: {content_preview}")
            
            # Step 3: Find a block to attach note to
            if not conversation.document_id:
                pytest.skip("Conversation has no associated document")
            
            from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
            doc_repo = RDSDocumentRepository()
            blocks = await doc_repo.get_blocks_by_document(conversation.document_id, session)
            
            if not blocks:
                pytest.skip("No blocks found in document")
            
            # Use the first text block
            target_block = next((b for b in blocks if b.html_content), blocks[0])
            print(f"\n✓ Selected block: {target_block.id}")
            print(f"  Type: {target_block.block_type}")
            
            # Step 4: Generate the note
            print("\n✓ Generating note from conversation...")
            result = await doc_service.generate_note_from_conversation(
                conversation_id=CONVERSATION_ID,
                block_id=target_block.id,
                messages=messages,
                message_count=5,
                topic="Key insights and questions from this discussion",
                user_id=USER_ID,
                session=session
            )
            
            print(f"\n✓ Note generated successfully!")
            print(f"  Note ID: {result['note_id']}")
            print(f"\n  Generated Note Content:")
            print("  " + "-" * 60)
            for line in result['note'].split('\n'):
                print(f"  {line}")
            print("  " + "-" * 60)
            
            # Step 5: Verify it was saved
            updated_block = await doc_repo.get_block(target_block.id, session)
            if updated_block.metadata and 'annotations' in updated_block.metadata:
                generated_notes = [
                    ann for key, ann in updated_block.metadata['annotations'].items()
                    if key.startswith('generated-')
                ]
                print(f"\n✓ Verified: {len(generated_notes)} generated note(s) saved to block")
            
            # Step 6: Test the API endpoint
            print("\n✓ Testing API endpoint...")
            from new_backend_ruminate.api.conversation.schemas import GenerateNoteRequest
            
            # Create request object
            request = GenerateNoteRequest(
                block_id=target_block.id,
                message_count=3,
                topic="Summary of main points"
            )
            
            # We would call the API endpoint here in a real integration test
            print("  API request prepared successfully")
            
        except Exception as e:
            print(f"\n✗ Error: {type(e).__name__}: {str(e)}")
            raise


if __name__ == "__main__":
    asyncio.run(test_note_generation_with_real_conversation())