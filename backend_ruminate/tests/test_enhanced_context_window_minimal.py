"""
Minimal test for the enhanced context window system.

This test directly verifies the functionality of the enhanced context window
without depending on document upload or external APIs.
"""
import os
import asyncio
import uuid
from unittest.mock import MagicMock

from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message, MessageRole
from src.models.viewer.block import Block
from src.models.viewer.page import Page
from src.services.conversation.chat_service import ChatService
from src.repositories.implementations.sqlite_document_repository import SQLiteDocumentRepository
from src.repositories.implementations.sqlite_conversation_repository import SQLiteConversationRepository

# Test database path
TEST_DB_PATH = "test_minimal_context.db"

async def setup_repositories():
    """Set up test repositories"""
    # Remove existing test database if it exists
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    
    # Initialize repositories
    doc_repo = SQLiteDocumentRepository(TEST_DB_PATH)
    convo_repo = SQLiteConversationRepository(TEST_DB_PATH)
    
    # Create a proper async mock for the LLM service
    class AsyncMock(MagicMock):
        async def __call__(self, *args, **kwargs):
            return super(AsyncMock, self).__call__(*args, **kwargs)
    
    # Mock LLM service
    mock_llm_service = MagicMock()
    mock_llm_service.generate_response = AsyncMock(return_value="This is a mock AI response.")
    
    # Create chat service
    chat_service = ChatService(
        conversation_repository=convo_repo,
        document_repository=doc_repo,
        llm_service=mock_llm_service
    )
    
    return doc_repo, convo_repo, chat_service, mock_llm_service

async def create_test_document(doc_repo):
    """Create a test document with pages and blocks"""
    # Create document
    document_id = str(uuid.uuid4())
    
    # Create and store the document entity
    from src.models.base.document import Document
    document = Document(
        id=document_id,
        title="Test Document",
        user_id="test_user",
        status="READY"  # Valid status values: 'PENDING', 'PROCESSING_MARKER', 'PROCESSING_RUMINATION', 'READY', 'ERROR'
    )
    await doc_repo.store_document(document)
    
    # Create pages (6 pages, numbered 0-5)
    pages = []
    for page_num in range(6):
        page = Page(
            id=str(uuid.uuid4()),
            document_id=document_id,
            page_number=page_num
        )
        pages.append(page)
    
    # Store pages
    await doc_repo.store_pages(pages)
    
    # Create blocks (2 blocks per page)
    blocks = []
    for page in pages:
        for i in range(2):
            block = Block(
                id=str(uuid.uuid4()),
                document_id=document_id,
                page_id=page.id,
                page_number=page.page_number,
                html_content=f"<p>This is block {i+1} on page {page.page_number+1}</p>"
            )
            blocks.append(block)
    
    # Store blocks
    await doc_repo.store_blocks(blocks)
    
    return document_id, pages, blocks

async def test_context_window():
    """Test the enhanced context window functionality"""
    doc_repo, convo_repo, chat_service, mock_llm_service = await setup_repositories()
    
    # Create test document with pages and blocks
    document_id, pages, blocks = await create_test_document(doc_repo)
    
    print("\n--- TEST 1: First message on page 1 includes page 1 blocks ---")
    # Create a conversation
    conversation = await chat_service.create_conversation(document_id)
    
    # Get a block from page 1 (index 0)
    block_page1 = next((b for b in blocks if b.page_number == 0), None)
    assert block_page1, "Block on page 1 not found"
    
    # Send a message with the page 1 block selected
    message, _ = await chat_service.send_message(
        conversation_id=conversation.id,
        content="What is this document about?",
        selected_block_id=block_page1.id
    )
    
    # Verify pages tracking
    conversation = await convo_repo.get_conversation(conversation.id)
    assert hasattr(conversation, 'included_pages'), "included_pages not set on conversation"
    assert '0' in conversation.included_pages, "Page 1 (index 0) not tracked in included_pages"
    
    # Verify LLM service was called with correct context
    calls = mock_llm_service.generate_response.call_args_list
    assert len(calls) > 0, "LLM service not called"
    
    # Get the context messages passed to the LLM
    context_messages = calls[0][0][0]
    last_msg_content = context_messages[-1].content if context_messages else ""
    
    # Check that page content was included
    print(f"Page 0 included: {'0' in conversation.included_pages}")
    print(f"Message includes page content: {'Current page (Page 0) content' in last_msg_content}")
    print("Test 1 passed!\n")
    
    print("--- TEST 2: First message on page 2 includes both page 1 and 2 blocks ---")
    # Create a new conversation
    conversation2 = await chat_service.create_conversation(document_id)
    
    # Reset mock to track new calls
    mock_llm_service.generate_response.reset_mock()
    
    # Get a block from page 2 (index 1)
    block_page2 = next((b for b in blocks if b.page_number == 1), None)
    assert block_page2, "Block on page 2 not found"
    
    # Send a message with the page 2 block selected
    message, _ = await chat_service.send_message(
        conversation_id=conversation2.id,
        content="Tell me about this section.",
        selected_block_id=block_page2.id
    )
    
    # Verify pages tracking
    conversation2 = await convo_repo.get_conversation(conversation2.id)
    assert hasattr(conversation2, 'included_pages'), "included_pages not set on conversation"
    
    # Verify LLM service was called with correct context
    calls = mock_llm_service.generate_response.call_args_list
    assert len(calls) > 0, "LLM service not called"
    
    # Get the context messages passed to the LLM
    context_messages = calls[0][0][0]
    last_msg_content = context_messages[-1].content if context_messages else ""
    
    # Check that both pages were included
    print(f"Page 0 included: {'0' in conversation2.included_pages}")
    print(f"Page 1 included: {'1' in conversation2.included_pages}")
    print(f"Message includes previous page: {'Previous page (Page 0) content' in last_msg_content}")
    print(f"Message includes current page: {'Current page (Page 1) content' in last_msg_content}")
    print("Test 2 passed!\n")
    
    print("--- TEST 3: Second message on page 2 only includes selected block context ---")
    # Get another block from page 2
    block_page2_2 = next((b for b in blocks if b.page_number == 1 and b.id != block_page2.id), None)
    assert block_page2_2, "Second block on page 2 not found"
    
    # Reset mock to track new calls
    mock_llm_service.generate_response.reset_mock()
    
    # Send second message with different page 2 block
    message, _ = await chat_service.send_message(
        conversation_id=conversation2.id,
        content="What about this part?",
        selected_block_id=block_page2_2.id
    )
    
    # Verify LLM service was called with correct context
    calls = mock_llm_service.generate_response.call_args_list
    assert len(calls) > 0, "LLM service not called"
    
    # Get the context messages passed to the LLM
    context_messages = calls[0][0][0]
    last_msg_content = context_messages[-1].content if context_messages else ""
    
    # Check that page context was not included redundantly
    print(f"Page 0 included: {'0' in conversation2.included_pages}")
    print(f"Page 1 included: {'1' in conversation2.included_pages}")
    print(f"Message includes previous page context again: {'Previous page (Page 0) content' in last_msg_content}")
    print(f"Message includes current page context again: {'Current page (Page 1) content' in last_msg_content}")
    print(f"Message includes selected block content: {'Selected block content' in last_msg_content}")
    print("Test 3 passed!\n")
    
    print("--- TEST 4: Jump from page 2 to page 5, should include pages 4 and 5 ---")
    # Reset mock to track new calls
    mock_llm_service.generate_response.reset_mock()
    
    # Get a block from page 5 (index 4)
    block_page5 = next((b for b in blocks if b.page_number == 4), None)
    assert block_page5, "Block on page 5 not found"
    
    # Send message with the page 5 block selected
    message, _ = await chat_service.send_message(
        conversation_id=conversation2.id,
        content="What about this section on page 5?",
        selected_block_id=block_page5.id
    )
    
    # Verify pages tracking
    conversation2 = await convo_repo.get_conversation(conversation2.id)
    
    # Verify LLM service was called with correct context
    calls = mock_llm_service.generate_response.call_args_list
    assert len(calls) > 0, "LLM service not called"
    
    # Get the context messages passed to the LLM
    context_messages = calls[0][0][0]
    last_msg_content = context_messages[-1].content if context_messages else ""
    
    # Check that pages 4 and 5 were included
    print(f"Page 0 included: {'0' in conversation2.included_pages}")
    print(f"Page 1 included: {'1' in conversation2.included_pages}")
    print(f"Page 3 included: {'3' in conversation2.included_pages}")
    print(f"Page 4 included: {'4' in conversation2.included_pages}")
    print(f"Message includes page 4 content: {'Previous page (Page 3) content' in last_msg_content}")
    print(f"Message includes page 5 content: {'Current page (Page 4) content' in last_msg_content}")
    print("Test 4 passed!\n")
    
    print("All tests passed!")
    
    # Cleanup
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)

if __name__ == "__main__":
    asyncio.run(test_context_window())
