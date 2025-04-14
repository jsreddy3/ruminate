from typing import Dict, Any, Optional
import logging
from src.repositories.interfaces.document_repository import DocumentRepository
from src.services.conversation.conversation_manager import ConversationManager
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.conversation.conversation_manager import ConversationManager

logger = logging.getLogger(__name__)

class DocumentExplorationTools:
    """
    Tools for exploring documents that can be used by the agent.
    Implements various document-related actions like getting page content or block content.
    """
    
    def __init__(self, 
                document_repository: DocumentRepository,
                conversation_manager: Optional[ConversationManager] = None):
        self.document_repo = document_repository
        self.conversation_manager = conversation_manager
        logger.debug("DocumentExplorationTools initialized")
    
    async def execute_action(self, action: str, action_input: Any, agent_state: Dict, session: Optional[AsyncSession]) -> Any:
        """Execute the action requested by the agent"""
        logger.info(f"Executing action: {action} with input: {action_input}")
        document_id = agent_state["document_id"]
            
        if action == "GET_PAGE":
            return await self._get_page(document_id, action_input, session)
                
        elif action == "GET_BLOCK":
            return await self._get_block(document_id, action_input, session)
                
        else:
            logger.warning(f"Unsupported action: {action}")
            return f"Unsupported action: {action}. Available actions are: GET_PAGE and GET_BLOCK."
    
    async def _get_page(self, document_id: str, page_input: Any, session: Optional[AsyncSession]) -> str:
        """Get the content of a specific page"""
        try:
            # Convert page number to int and adjust for 0-indexing if needed
            page_num = int(page_input) - 1  # Assuming user-facing page numbers start at 1
            
            # Get page content
            page = await self.document_repo.get_page_by_number(document_id, page_num, session)
            if not page:
                logger.warning(f"Page {page_num + 1} not found")
                return f"Page {page_num + 1} not found."
                
            blocks = await self.document_repo.get_page_blocks(page.id, session)
            
            if not blocks:
                logger.warning(f"Page {page_num + 1} exists but contains no content blocks.")
                return f"Page {page_num + 1} exists but contains no content blocks."
            
            # Format the page content
            page_content = []
            for block in blocks:
                block_text = self._strip_html(block.html_content) if block.html_content else "No content"
                page_content.append(f"Block ID: {block.id}\n{block_text}")
            
            return f"Content of Page {page_num + 1}:\n\n" + "\n\n".join(page_content)
            
        except ValueError:
            logger.error(f"Invalid page number: {page_input}")
            return f"Invalid page number: {page_input}. Please provide a valid integer."
    
    async def _get_block(self, document_id: str, block_id: str, session: Optional[AsyncSession]) -> str:
        """Get the content of a specific block"""
        block_id = str(block_id)
        logger.debug(f"Getting block with ID: {block_id}")
        block = await self.document_repo.get_block(block_id, session)
        
        if not block:
            logger.warning(f"Block {block_id} not found")
            return f"Block {block_id} not found."
            
        block_text = self._strip_html(block.html_content) if block.html_content else "No content"
        return f"Content of Block {block_id} (Page {block.page_number + 1 if block.page_number is not None else 'Unknown'}):\n\n{block_text}"
    
    def _strip_html(self, html_content: Optional[str]) -> str:
        """Strip HTML tags from content, delegating to conversation manager if available"""
        if not html_content:
            return ""
            
        if self.conversation_manager and hasattr(self.conversation_manager, '_strip_html'):
            return self.conversation_manager._strip_html(html_content)
        
        # Basic fallback implementation if conversation manager is not available
        import re
        clean = re.compile('<.*?>')
        return re.sub(clean, '', html_content)