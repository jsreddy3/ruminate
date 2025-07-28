# new_backend_ruminate/context/windowed/providers/page_range.py

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.domain.document.entities.page import Page
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface
import re


class PageRangeProvider:
    """Provides page range content for context"""
    
    def __init__(self, doc_repo: DocumentRepositoryInterface, page_radius: int = 3):
        """
        Args:
            doc_repo: Document repository for data access
            page_radius: Number of pages to include on each side of current page
        """
        self.page_radius = page_radius
        self.doc_repo = doc_repo
    
    async def get_page_content(
        self, 
        conv: Conversation, 
        thread: List[Message], 
        *, 
        session: AsyncSession
    ) -> str:
        """Get page range content based on current page derived from messages"""
        if not conv.document_id:
            return ""
            
        current_page = await self._derive_current_page(conv, thread, session=session)
        if current_page is None:
            return ""
            
        pages = await self.doc_repo.get_pages_in_range(
            conv.document_id, 
            current_page, 
            self.page_radius, 
            session
        )
        
        return self._format_page_content(pages, current_page)
    
    async def _derive_current_page(
        self, 
        conv: Conversation, 
        thread: List[Message], 
        *, 
        session: AsyncSession
    ) -> Optional[int]:
        """Derive current page based on conversation type"""
        from new_backend_ruminate.domain.conversation.entities.conversation import ConversationType
        
        if conv.type == ConversationType.RABBITHOLE:
            # Rabbithole conversations have FIXED page context based on source_block_id
            if conv.source_block_id:
                block = await self.doc_repo.get_block(conv.source_block_id, session)
                if block and block.page_number:
                    return block.page_number
        else:
            # Normal conversations have DYNAMIC page context from latest message
            for msg in reversed(thread):
                if msg.role.value == "user" and msg.block_id:
                    block = await self.doc_repo.get_block(msg.block_id, session)
                    if block and block.page_number:
                        return block.page_number
            
            # Fall back to conversation's source_block_id if available
            if conv.source_block_id:
                block = await self.doc_repo.get_block(conv.source_block_id, session)
                if block and block.page_number:
                    return block.page_number
                
        return None
    
    def _format_page_content(self, pages: List[Page], current_page: int) -> str:
        """Format pages into readable context with page markers"""
        if not pages:
            return ""
            
        content_parts = []
        
        for page in pages:
            page_marker = f"--- Page {page.page_number}"
            if page.page_number == current_page:
                page_marker += " (CURRENT)"
            page_marker += " ---"
            
            # Strip HTML from page content
            page_text = self._strip_html(page.html_content)
            if page_text.strip():
                content_parts.append(f"{page_marker}\n{page_text}")
        
        return "\n\n".join(content_parts)
    
    def _strip_html(self, html_content: str) -> str:
        """Simple text extraction from HTML content"""
        if not html_content:
            return ""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', html_content)
        # Clean up whitespace
        text = ' '.join(text.split())
        return text.strip()