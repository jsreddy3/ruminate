# tests/test_rabbithole_integration.py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.tests.stubs import StubLLM, StubContextBuilder
from new_backend_ruminate.infrastructure.conversation.rds_conversation_repository import RDSConversationRepository


@pytest_asyncio.fixture
async def conversation_service():
    """Create ConversationService with stubs for testing"""
    repo = RDSConversationRepository()
    llm = StubLLM()
    hub = EventStreamHub()
    ctx_builder = StubContextBuilder()
    return ConversationService(repo, llm, hub, ctx_builder)


@pytest.mark.asyncio
async def test_rabbithole_with_real_document_basic(db_session: AsyncSession, conversation_service):
    """
    Test 1: Create a rabbithole conversation using a real document that was already uploaded.
    This is the simplest possible test - just verify we can create a rabbithole from real data.
    """
    # First, let's upload a real document to the test database
    from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
    from new_backend_ruminate.domain.document.entities import Document, DocumentStatus, Block
    from uuid import uuid4
    from datetime import datetime
    
    doc_repo = RDSDocumentRepository()
    
    # Create a simple test document with a block
    document_id = str(uuid4())
    document = Document(
        id=document_id,
        title="Test Declaration",
        status=DocumentStatus.READY,
        summary="A test document about independence",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    # Create the document first
    await doc_repo.create_document(document, db_session)
    
    # Create a test block with substantial content
    from new_backend_ruminate.domain.document.entities import BlockType
    block = Block(
        id=str(uuid4()),
        document_id=document_id,
        html_content="<p>When in the course of human events, it becomes necessary for one people to dissolve the political bands which have connected them with another, and to assume among the powers of the earth, the separate and equal station to which the Laws of Nature and of Nature's God entitle them, a decent respect to the opinions of mankind requires that they should declare the causes which impel them to the separation.</p>",
        block_type=BlockType.TEXT,
        page_number=0
    )
    
    # Save the block
    await doc_repo.create_blocks([block], db_session)
    
    # Get blocks from the document we just created
    blocks = await doc_repo.get_blocks_by_document(document_id, db_session)
    
    # Verify we have blocks
    assert len(blocks) > 0, f"Expected blocks but found none for document {document_id}"
    
    # Use the block we created
    target_block = blocks[0]
    
    # Extract some meaningful text from the block for selection
    import re
    text_content = re.sub(r'<[^>]+>', '', target_block.html_content)
    selected_text = "human events"  # A meaningful phrase from our test content
    
    assert selected_text in text_content, f"Selected text '{selected_text}' not found in block content"
    
    # Create rabbithole conversation
    conv_id, root_id = await conversation_service.create_conversation(
        conv_type="rabbithole",
        document_id=document_id,
        source_block_id=target_block.id,
        selected_text=selected_text,
        text_start_offset=0,
        text_end_offset=len(selected_text)
    )
    
    # Verify conversation was created correctly
    conv = await db_session.get(Conversation, conv_id)
    assert conv is not None
    assert conv.type == ConversationType.RABBITHOLE
    assert conv.document_id == document_id
    assert conv.source_block_id == target_block.id
    assert conv.selected_text == selected_text
    
    print(f"✅ Successfully created rabbithole conversation {conv_id}")
    print(f"   Document: {document_id}")
    print(f"   Block: {target_block.id}")
    print(f"   Selected text: '{selected_text}'")


@pytest.mark.asyncio
async def test_rabbithole_context_rendering(db_session: AsyncSession):
    """
    Test 2: Verify that rabbithole context is properly rendered with real document data.
    This tests the context rendering system to ensure selected text, block context, and document summary are included.
    """
    # Create document and block (same setup as test 1)
    from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
    from new_backend_ruminate.domain.document.entities import Document, DocumentStatus, Block, BlockType
    from uuid import uuid4
    from datetime import datetime
    
    doc_repo = RDSDocumentRepository()
    
    document_id = str(uuid4())
    document = Document(
        id=document_id,
        title="Test Declaration",
        status=DocumentStatus.READY,
        summary="A test document about independence",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    await doc_repo.create_document(document, db_session)
    
    block = Block(
        id=str(uuid4()),
        document_id=document_id,
        html_content="<p>When in the course of human events, it becomes necessary for one people to dissolve the political bands which have connected them with another, and to assume among the powers of the earth, the separate and equal station to which the Laws of Nature and of Nature's God entitle them, a decent respect to the opinions of mankind requires that they should declare the causes which impel them to the separation.</p>",
        block_type=BlockType.TEXT,
        page_number=0
    )
    await doc_repo.create_blocks([block], db_session)
    
    # Create rabbithole conversation
    conv = Conversation(
        id=str(uuid4()),
        type=ConversationType.RABBITHOLE,
        document_id=document_id,
        source_block_id=block.id,
        selected_text="human events",
        text_start_offset=21,
        text_end_offset=33
    )
    db_session.add(conv)
    
    # Create system message with rabbithole template
    msg = Message(
        id=str(uuid4()),
        conversation_id=conv.id,
        role=Role.SYSTEM,
        content="""This is a deep-dive conversation focused on a selected text from a document.

Selected text:
```
{selected_text}
```

{block_context}
{document_summary}

You are a helpful assistant focusing specifically on exploring this selected topic in depth.""",
        version=0
    )
    db_session.add(msg)
    await db_session.commit()
    
    # Now test the context rendering
    from new_backend_ruminate.context.renderers.rabbithole import rabbithole_system_renderer
    
    rendered_content = await rabbithole_system_renderer(msg, conv, session=db_session)
    
    print(f"🔍 Rendered context:")
    print(rendered_content)
    print()
    
    # Verify the context contains expected elements
    assert "human events" in rendered_content, "Selected text should be in rendered context"
    assert "When in the course of human events" in rendered_content, "Block context should be included"
    assert "A test document about independence" in rendered_content, "Document summary should be included"
    assert "{selected_text}" not in rendered_content, "Template variables should be replaced"
    assert "{block_context}" not in rendered_content, "Template variables should be replaced" 
    assert "{document_summary}" not in rendered_content, "Template variables should be replaced"
    
    print("✅ Context rendering test passed - all expected content found and templates replaced")