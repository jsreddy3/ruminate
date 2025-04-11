"""
Test Enhanced Context Window System for Document Conversations

This script tests the enhanced context window system that tracks included pages
in document conversations and adds appropriate context for each message.

It tests the following cases:
1. First message on page 1 includes page 1 blocks
2. First message on page 2 includes both page 1 and 2 blocks
3. Second message on page 2 only needs to include page 2 blocks (page 1 already included)
4. Message on page 5 includes both page 4 and 5 blocks
5. Complex navigation pattern (page 2 -> page 1 -> page 2 -> page 5)
"""
import os
import pytest
import asyncio
from unittest.mock import patch, MagicMock
import json
import logging
from pathlib import Path
from fastapi import UploadFile
from fastapi.datastructures import UploadFile as UploadFileStruct

from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message, MessageRole
from src.models.viewer.block import Block
from src.models.viewer.page import Page
from src.services.conversation.chat_service import ChatService
from src.services.document.upload_service import UploadService
from src.repositories.implementations.sqlite_document_repository import SQLiteDocumentRepository
from src.repositories.implementations.sqlite_conversation_repository import SQLiteConversationRepository
from src.services.ai.llm_service import LLMService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test DB paths
TEST_DB_PATH = "test_convo_context.db"
TEST_PDF_PATH = os.path.join(os.path.dirname(__file__), "six_pages_two_blocks.pdf")


class TestEnhancedContextWindow:
    """Test suite for enhanced context window system in document conversations"""

    @pytest.fixture(autouse=True)
    async def setup_and_teardown(self):
        """Set up repositories and services, then cleanup after tests"""
        # Set up repositories
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)

        self.doc_repo = SQLiteDocumentRepository(TEST_DB_PATH)
        self.convo_repo = SQLiteConversationRepository(TEST_DB_PATH)
        
        # Create mock LLM service that returns a predetermined response
        self.mock_llm_service = MagicMock(spec=LLMService)
        self.mock_llm_service.generate_response.return_value = "This is a mock AI response."
        
        # Create chat service with real repos and mock LLM
        self.chat_service = ChatService(
            conversation_repository=self.convo_repo,
            document_repository=self.doc_repo,
            llm_service=self.mock_llm_service
        )
        
        # Upload the test PDF
        await self.upload_test_pdf()
        
        yield
        
        # Cleanup
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
    
    async def upload_test_pdf(self):
        """Upload the test PDF and create mock blocks and pages"""
        # Read the test PDF
        with open(TEST_PDF_PATH, "rb") as f:
            pdf_data = f.read()
        
        # Create a mock UploadFile for testing
        mock_file = MagicMock(spec=UploadFile)
        mock_file.filename = "six_pages_two_blocks.pdf"
        mock_file.read = MagicMock(return_value=pdf_data)
        
        # Mock storage repo to avoid actual S3 upload
        mock_storage_repo = MagicMock()
        mock_storage_repo.store_file.return_value = "mock-s3-path"
        
        # Mock marker service to avoid calling external API
        mock_marker = MagicMock()
        
        # Create mock pages and blocks for the test PDF
        pages = []
        blocks = []
        
        for page_num in range(6):  # 6 pages
            page = Page(
                document_id="test-doc-id",
                page_number=page_num
            )
            pages.append(page)
            
            # Create two blocks for each page
            for i in range(2):
                block = Block(
                    document_id="test-doc-id",
                    page_id=page.id,
                    page_number=page_num,
                    html_content=f"<p>This is block {i+1} on page {page_num+1}</p>"
                )
                blocks.append(block)
                page.add_block(block.id)
        
        mock_marker.process_document.return_value = (pages, blocks)
        
        # Mock critical content service
        mock_critical_content = MagicMock()
        mock_critical_content._get_document_summary.return_value = "This is a summary of the test PDF with 6 pages."
        
        # Create upload service
        upload_service = UploadService(
            storage_repo=mock_storage_repo,
            marker=mock_marker,
            critical_content_service=mock_critical_content,
            document_repo=self.doc_repo
        )
        
        # Create a mock background tasks
        mock_bg_tasks = MagicMock()
        mock_bg_tasks.add_task = MagicMock()
        
        # Call the upload method
        document = await upload_service.upload(
            file=mock_file,
            background_tasks=mock_bg_tasks
        )
        
        # Store the pages and blocks directly
        await self.doc_repo.store_pages(pages)
        await self.doc_repo.store_blocks(blocks)
        
        # Store test document ID
        self.document_id = document.id
        self.pages = pages
        self.blocks = blocks
        
        logger.info(f"Uploaded test PDF with document ID: {self.document_id}")
    
    def get_block_for_page(self, page_num, block_index=0):
        """Helper to get a block for a specific page"""
        page_blocks = [b for b in self.blocks if b.page_number == page_num]
        return page_blocks[block_index] if page_blocks else None
    
    async def test_case1_first_message_page1(self):
        """Test Case 1: First message on page 1 includes page 1 blocks"""
        logger.info("Testing Case 1: First message on page 1")
        
        # Create a conversation
        conversation = await self.chat_service.create_conversation(self.document_id)
        
        # Get a block from page 1 (index 0)
        block_page1 = self.get_block_for_page(0)
        assert block_page1 is not None, "Could not find block on page 1"
        
        # Send a message with the page 1 block selected
        message, _ = await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="What is this document about?",
            selected_block_id=block_page1.id
        )
        
        # Verify pages tracking
        conversation = await self.convo_repo.get_conversation(conversation.id)
        assert hasattr(conversation, 'included_pages'), "included_pages not set on conversation"
        assert '0' in conversation.included_pages, "Page 1 (index 0) not tracked in included_pages"
        
        # Verify LLM service was called with correct context
        # The message should include all blocks from page 1
        calls = self.mock_llm_service.generate_response.call_args_list
        assert len(calls) > 0, "LLM service not called"
        
        # Get the context messages passed to the LLM
        context_messages = calls[0][0][0]
        
        # The last message should contain content from page 1
        last_msg_content = context_messages[-1].content
        
        assert "Current page (Page 0) content" in last_msg_content, "Page 1 content not included"
        assert "This is block 1 on page 1" in last_msg_content, "Block 1 content not included"
        assert "This is block 2 on page 1" in last_msg_content, "Block 2 content not included"
        assert "User query: What is this document about?" in last_msg_content, "User query not included"
        
        logger.info("Case 1 test passed!")
    
    async def test_case2_first_message_page2(self):
        """Test Case 2: First message on page 2 includes both page 1 and 2 blocks"""
        logger.info("Testing Case 2: First message on page 2")
        
        # Create a conversation
        conversation = await self.chat_service.create_conversation(self.document_id)
        
        # Get a block from page 2 (index 1)
        block_page2 = self.get_block_for_page(1)
        assert block_page2 is not None, "Could not find block on page 2"
        
        # Send a message with the page 2 block selected
        message, _ = await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="Tell me about this section.",
            selected_block_id=block_page2.id
        )
        
        # Verify pages tracking
        conversation = await self.convo_repo.get_conversation(conversation.id)
        assert hasattr(conversation, 'included_pages'), "included_pages not set on conversation"
        assert '0' in conversation.included_pages, "Page 1 (index 0) not tracked in included_pages"
        assert '1' in conversation.included_pages, "Page 2 (index 1) not tracked in included_pages"
        
        # Verify LLM service was called with correct context
        calls = self.mock_llm_service.generate_response.call_args_list
        assert len(calls) > 0, "LLM service not called"
        
        # Get the context messages passed to the LLM
        context_messages = calls[0][0][0]
        
        # The last message should contain content from both pages
        last_msg_content = context_messages[-1].content
        
        assert "Previous page (Page 0) content" in last_msg_content, "Page 1 content not included"
        assert "Current page (Page 1) content" in last_msg_content, "Page 2 content not included"
        assert "This is block 1 on page 1" in last_msg_content, "Page 1 block 1 content not included"
        assert "This is block 1 on page 2" in last_msg_content, "Page 2 block 1 content not included"
        assert "User query: Tell me about this section." in last_msg_content, "User query not included"
        
        logger.info("Case 2 test passed!")
    
    async def test_case3_second_message_same_page(self):
        """Test Case 3: Second message on page 2 only needs to include selected block context"""
        logger.info("Testing Case 3: Second message on same page")
        
        # Create a conversation
        conversation = await self.chat_service.create_conversation(self.document_id)
        
        # Get blocks from page 2 (index 1)
        block_page2_1 = self.get_block_for_page(1, 0)
        block_page2_2 = self.get_block_for_page(1, 1)
        assert block_page2_1 is not None, "Could not find first block on page 2"
        assert block_page2_2 is not None, "Could not find second block on page 2"
        
        # Send first message with page 2 block 1
        await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="Tell me about this section.",
            selected_block_id=block_page2_1.id
        )
        
        # Reset mock to track new calls
        self.mock_llm_service.generate_response.reset_mock()
        
        # Send second message with page 2 block 2
        message, _ = await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="What about this part?",
            selected_block_id=block_page2_2.id
        )
        
        # Verify pages tracking
        conversation = await self.convo_repo.get_conversation(conversation.id)
        assert hasattr(conversation, 'included_pages'), "included_pages not set on conversation"
        assert '0' in conversation.included_pages, "Page 1 (index 0) not tracked in included_pages"
        assert '1' in conversation.included_pages, "Page 2 (index 1) not tracked in included_pages"
        
        # Verify LLM service was called with correct context
        calls = self.mock_llm_service.generate_response.call_args_list
        assert len(calls) > 0, "LLM service not called"
        
        # Get the context messages passed to the LLM
        context_messages = calls[0][0][0]
        
        # The last message should NOT include page 1 or 2 blocks, only selected block
        last_msg_content = context_messages[-1].content
        
        # Shouldn't contain any page content headers since they're already included
        assert "Previous page (Page 0) content" not in last_msg_content, "Page 1 content included redundantly"
        assert "Current page (Page 1) content" not in last_msg_content, "Page 2 content included redundantly"
        
        # Should contain selected block content
        assert "Selected block content" in last_msg_content, "Selected block content not included"
        assert "This is block 2 on page 2" in last_msg_content, "Selected block text not included"
        assert "User query: What about this part?" in last_msg_content, "User query not included"
        
        logger.info("Case 3 test passed!")
    
    async def test_case4_jump_to_page5(self):
        """Test Case 4: Jump from page 2 to page 5, should include pages 4 and 5"""
        logger.info("Testing Case 4: Jump to page 5")
        
        # Create a conversation
        conversation = await self.chat_service.create_conversation(self.document_id)
        
        # Get a block from page 2 (index 1)
        block_page2 = self.get_block_for_page(1)
        assert block_page2 is not None, "Could not find block on page 2"
        
        # Send first message with page 2 block selected
        await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="Tell me about page 2.",
            selected_block_id=block_page2.id
        )
        
        # Reset mock to track new calls
        self.mock_llm_service.generate_response.reset_mock()
        
        # Get a block from page 5 (index 4)
        block_page5 = self.get_block_for_page(4)
        assert block_page5 is not None, "Could not find block on page 5"
        
        # Send message with the page 5 block selected
        message, _ = await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="What about this section on page 5?",
            selected_block_id=block_page5.id
        )
        
        # Verify pages tracking
        conversation = await self.convo_repo.get_conversation(conversation.id)
        assert hasattr(conversation, 'included_pages'), "included_pages not set on conversation"
        assert '0' in conversation.included_pages, "Page 1 (index 0) not tracked in included_pages"
        assert '1' in conversation.included_pages, "Page 2 (index 1) not tracked in included_pages"
        assert '3' in conversation.included_pages, "Page 4 (index 3) not tracked in included_pages"
        assert '4' in conversation.included_pages, "Page 5 (index 4) not tracked in included_pages"
        
        # Verify LLM service was called with correct context
        calls = self.mock_llm_service.generate_response.call_args_list
        assert len(calls) > 0, "LLM service not called"
        
        # Get the context messages passed to the LLM
        context_messages = calls[0][0][0]
        
        # The last message should contain content from pages 4 and 5
        last_msg_content = context_messages[-1].content
        
        assert "Previous page (Page 3) content" in last_msg_content, "Page 4 content not included"
        assert "Current page (Page 4) content" in last_msg_content, "Page 5 content not included"
        assert "This is block 1 on page 4" in last_msg_content, "Page 4 block content not included"
        assert "This is block 1 on page 5" in last_msg_content, "Page 5 block content not included"
        assert "Selected block content" in last_msg_content, "Selected block content not included"
        assert "User query: What about this section on page 5?" in last_msg_content, "User query not included"
        
        logger.info("Case 4 test passed!")
    
    async def test_case5_complex_navigation(self):
        """Test Case 5: Complex navigation - page 2 -> page 1 -> page 2 -> page 5"""
        logger.info("Testing Case 5: Complex navigation pattern")
        
        # Create a conversation
        conversation = await self.chat_service.create_conversation(self.document_id)
        
        # 1. First message on page 2
        block_page2 = self.get_block_for_page(1)
        await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="Tell me about page 2.",
            selected_block_id=block_page2.id
        )
        
        # Check included pages
        conversation = await self.convo_repo.get_conversation(conversation.id)
        assert '0' in conversation.included_pages, "Page 1 not included after first message"
        assert '1' in conversation.included_pages, "Page 2 not included after first message"
        
        # 2. Second message on page 1
        self.mock_llm_service.generate_response.reset_mock()
        block_page1 = self.get_block_for_page(0)
        await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="Now tell me about page 1.",
            selected_block_id=block_page1.id
        )
        
        # Verify no duplicate page content
        calls = self.mock_llm_service.generate_response.call_args_list
        context_messages = calls[0][0][0]
        last_msg_content = context_messages[-1].content
        assert "Previous page" not in last_msg_content, "Previous page content included redundantly"
        assert "Current page (Page 0) content" not in last_msg_content, "Page 1 content included redundantly"
        assert "Selected block content" in last_msg_content, "Selected block content not included"
        
        # 3. Third message on page 2 again
        self.mock_llm_service.generate_response.reset_mock()
        await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="Back to page 2.",
            selected_block_id=block_page2.id
        )
        
        # Verify no duplicate page content
        calls = self.mock_llm_service.generate_response.call_args_list
        context_messages = calls[0][0][0]
        last_msg_content = context_messages[-1].content
        assert "Previous page" not in last_msg_content, "Previous page content included redundantly"
        assert "Current page (Page 1) content" not in last_msg_content, "Page 2 content included redundantly"
        assert "Selected block content" in last_msg_content, "Selected block content not included"
        
        # 4. Fourth message on page 5
        self.mock_llm_service.generate_response.reset_mock()
        block_page5 = self.get_block_for_page(4)
        await self.chat_service.send_message(
            conversation_id=conversation.id,
            content="Jump to page 5.",
            selected_block_id=block_page5.id
        )
        
        # Verify pages 4 and 5 included
        conversation = await self.convo_repo.get_conversation(conversation.id)
        assert '3' in conversation.included_pages, "Page 4 not included after jumping to page 5"
        assert '4' in conversation.included_pages, "Page 5 not included after jumping to page 5"
        
        # Verify correct context in final message
        calls = self.mock_llm_service.generate_response.call_args_list
        context_messages = calls[0][0][0]
        last_msg_content = context_messages[-1].content
        
        assert "Previous page (Page 3) content" in last_msg_content, "Page 4 content not included"
        assert "Current page (Page 4) content" in last_msg_content, "Page 5 content not included"
        assert "Selected block content" in last_msg_content, "Selected block content not included"
        
        logger.info("Case 5 test passed!")


# Run tests synchronously
if __name__ == "__main__":
    async def run_tests():
        test = TestEnhancedContextWindow()
        
        # Manually setup (replicate what the fixture would do)
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)

        test.doc_repo = SQLiteDocumentRepository(TEST_DB_PATH)
        test.convo_repo = SQLiteConversationRepository(TEST_DB_PATH)
        
        test.mock_llm_service = MagicMock(spec=LLMService)
        test.mock_llm_service.generate_response.return_value = "This is a mock AI response."
        
        test.chat_service = ChatService(
            conversation_repository=test.convo_repo,
            document_repository=test.doc_repo,
            llm_service=test.mock_llm_service
        )
        
        # Upload test PDF
        await test.upload_test_pdf()
        
        try:
            await test.test_case1_first_message_page1()
            await test.test_case2_first_message_page2()
            await test.test_case3_second_message_same_page()
            await test.test_case4_jump_to_page5()
            await test.test_case5_complex_navigation()
            print("All tests passed!")
        finally:
            # Cleanup
            if os.path.exists(TEST_DB_PATH):
                os.remove(TEST_DB_PATH)
    
    asyncio.run(run_tests())
