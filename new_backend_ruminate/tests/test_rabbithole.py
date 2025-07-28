# tests/test_rabbithole.py
import pytest
import pytest_asyncio
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.infrastructure.conversation.rds_conversation_repository import RDSConversationRepository
from new_backend_ruminate.infrastructure.document.models import DocumentModel, BlockModel
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.tests.stubs import StubLLM, StubContextBuilder


@pytest_asyncio.fixture
async def setup_document_data(db_session: AsyncSession):
    """Create test document and block data"""
    import uuid
    doc_id = f"doc_{uuid.uuid4().hex[:8]}"
    block_id = f"block_{uuid.uuid4().hex[:8]}"
    
    # Create a test document
    document = DocumentModel(
        id=doc_id,
        title="Test Document",
        summary="This is a test document about AI",
        status="READY"
    )
    db_session.add(document)
    
    # Create a test block
    block = BlockModel(
        id=block_id,
        document_id=doc_id,
        block_type="paragraph",
        html_content="<p>This is a paragraph about machine learning algorithms and their applications.</p>",
        page_number=1
    )
    db_session.add(block)
    
    await db_session.commit()
    return document, block


@pytest_asyncio.fixture
async def svc():
    """Create ConversationService with stubs"""
    repo = RDSConversationRepository()
    llm = StubLLM()
    hub = EventStreamHub()
    ctx_builder = StubContextBuilder()
    return ConversationService(repo, llm, hub, ctx_builder)


@pytest.mark.asyncio
async def test_create_rabbithole_conversation(db_session, svc, setup_document_data):
    """Test creating a rabbithole conversation with selected text"""
    document, block = setup_document_data
    
    # Create a rabbithole conversation
    conv_id, root_id = await svc.create_conversation(
        conv_type="rabbithole",
        document_id=document.id,
        source_block_id=block.id,
        selected_text="machine learning algorithms",
        text_start_offset=23,
        text_end_offset=50
    )
    
    # Verify conversation was created correctly
    conv = await db_session.get(Conversation, conv_id)
    assert conv is not None
    assert conv.type == ConversationType.RABBITHOLE
    assert conv.document_id == document.id
    assert conv.source_block_id == block.id
    assert conv.selected_text == "machine learning algorithms"
    assert conv.text_start_offset == 23
    assert conv.text_end_offset == 50
    
    # Verify system message was created
    root_msg = await db_session.get(Message, root_id)
    assert root_msg is not None
    assert root_msg.role == Role.SYSTEM
    assert "{selected_text}" in root_msg.content  # Template should be stored


@pytest.mark.asyncio
async def test_query_rabbitholes_by_block(db_session, svc, setup_document_data):
    """Test querying rabbitholes for a specific block"""
    document, block = setup_document_data
    
    # Create multiple rabbithole conversations for the same block
    conv1_id, _ = await svc.create_conversation(
        conv_type="rabbithole",
        document_id=document.id,
        source_block_id=block.id,
        selected_text="machine learning",
        text_start_offset=23,
        text_end_offset=39
    )
    
    conv2_id, _ = await svc.create_conversation(
        conv_type="rabbithole",
        document_id=document.id,
        source_block_id=block.id,
        selected_text="applications",
        text_start_offset=60,
        text_end_offset=72
    )
    
    # Query conversations by block
    conversations = await svc.get_conversations_by_criteria(
        {"source_block_id": block.id, "type": ConversationType.RABBITHOLE},
        db_session
    )
    
    assert len(conversations) == 2
    conv_ids = {c.id for c in conversations}
    assert conv1_id in conv_ids
    assert conv2_id in conv_ids


@pytest.mark.asyncio
async def test_rabbithole_context_rendering(db_session, setup_document_data):
    """Test that rabbithole context is properly rendered"""
    from new_backend_ruminate.context.renderers.rabbithole import rabbithole_system_renderer
    
    document, block = setup_document_data
    
    # Create a rabbithole conversation and message
    conv = Conversation(
        id="conv1",
        type=ConversationType.RABBITHOLE,
        document_id=document.id,
        source_block_id=block.id,
        selected_text="machine learning algorithms",
        text_start_offset=23,
        text_end_offset=50
    )
    db_session.add(conv)
    
    msg = Message(
        id="msg1",
        conversation_id=conv.id,
        role=Role.SYSTEM,
        content="""This is a deep-dive conversation focused on a selected text from a document.

Selected text:
```
{selected_text}
```

{block_context}
{document_summary}

You are a helpful assistant focusing specifically on exploring this selected topic in depth.
Provide detailed analysis and insights based on this specific selection and its context.
Answer accurately, concisely, and precisely—avoid long lists of answers. Understand 
the user's question/comment intuitively and provide them a clear response. Answer naturally as well.""",
        version=0
    )
    db_session.add(msg)
    await db_session.commit()
    
    # Render the message
    rendered = await rabbithole_system_renderer(msg, conv, session=db_session)
    
    # Verify the template was filled
    assert "machine learning algorithms" in rendered
    assert "This is a paragraph about machine learning algorithms" in rendered
    assert "This is a test document about AI" in rendered
    assert "{selected_text}" not in rendered  # Template variable should be replaced


@pytest.mark.asyncio
async def test_regular_conversation_still_works(db_session, svc):
    """Ensure regular conversations still work after rabbithole changes"""
    # Create a regular chat conversation
    conv_id, root_id = await svc.create_conversation(
        conv_type="chat"
    )
    
    # Verify it was created correctly
    conv = await db_session.get(Conversation, conv_id)
    assert conv is not None
    assert conv.type == ConversationType.CHAT
    assert conv.document_id is None
    assert conv.source_block_id is None
    assert conv.selected_text is None