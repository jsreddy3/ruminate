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
            with open("/tmp/page_range_debug.txt", "a") as f:
                f.write("get_page_content: No document_id, returning empty\n\n")
            return ""
            
        current_page = await self._derive_current_page(conv, thread, session=session)
        if current_page is None:
            with open("/tmp/page_range_debug.txt", "a") as f:
                f.write("get_page_content: No current_page derived, returning empty\n\n")
            return ""
            
        with open("/tmp/page_range_debug.txt", "a") as f:
            f.write(f"get_page_content: Fetching pages around page {current_page} with radius {self.page_radius}\n")
            
        pages = await self.doc_repo.get_pages_in_range_with_blocks(
            conv.document_id, 
            current_page, 
            self.page_radius, 
            session
        )
        
        with open("/tmp/page_range_debug.txt", "a") as f:
            f.write(f"get_page_content: Found {len(pages)} pages: {[p.page_number for p in pages]}\n")
        
        result = await self._format_page_content(pages, current_page, session)
        
        with open("/tmp/page_range_debug.txt", "a") as f:
            f.write(f"get_page_content: Formatted content length: {len(result)}\n\n")
        
        return result
    
    async def _derive_current_page(
        self, 
        conv: Conversation, 
        thread: List[Message], 
        *, 
        session: AsyncSession
    ) -> Optional[int]:
        """Derive current page based on conversation type"""
        from new_backend_ruminate.domain.conversation.entities.conversation import ConversationType
        import os
        
        # Debug to file
        debug_info = []
        debug_info.append(f"PageRangeProvider: Deriving current page for conv_type={conv.type}, document_id={conv.document_id}")
        
        if conv.type == ConversationType.RABBITHOLE:
            # Rabbithole conversations have FIXED page context based on source_block_id
            debug_info.append(f"PageRangeProvider: RABBITHOLE conv, source_block_id={conv.source_block_id}")
            if conv.source_block_id:
                block = await self.doc_repo.get_block(conv.source_block_id, session)
                debug_info.append(f"PageRangeProvider: Found source block: {block.id if block else None}, page_number={block.page_number if block else None}")
                if block and block.page_number:
                    with open("/tmp/page_range_debug.txt", "a") as f:
                        f.write("\n".join(debug_info) + f"\nReturning page: {block.page_number}\n\n")
                    return block.page_number
        else:
            # Normal conversations have DYNAMIC page context from latest message
            debug_info.append(f"PageRangeProvider: DYNAMIC page derivation, checking {len(thread)} messages")
            for i, msg in enumerate(reversed(thread)):
                # Handle both string and enum role types
                role_value = msg.role.value if hasattr(msg.role, 'value') else msg.role
                debug_info.append(f"PageRangeProvider: Message {i}: role={role_value}, block_id={msg.block_id}")
                if role_value == "user" and msg.block_id:
                    block = await self.doc_repo.get_block(msg.block_id, session)
                    debug_info.append(f"PageRangeProvider: Found user message block: {block.id if block else None}, page_number={block.page_number if block else None}")
                    if block and block.page_number:
                        with open("/tmp/page_range_debug.txt", "a") as f:
                            f.write("\n".join(debug_info) + f"\nReturning page: {block.page_number}\n\n")
                        return block.page_number
            
            # Fall back to conversation's source_block_id if available
            debug_info.append(f"PageRangeProvider: Falling back to conv source_block_id={conv.source_block_id}")
            if conv.source_block_id:
                block = await self.doc_repo.get_block(conv.source_block_id, session)
                debug_info.append(f"PageRangeProvider: Found fallback block: {block.id if block else None}, page_number={block.page_number if block else None}")
                if block and block.page_number:
                    with open("/tmp/page_range_debug.txt", "a") as f:
                        f.write("\n".join(debug_info) + f"\nReturning page: {block.page_number}\n\n")
                    return block.page_number
        
        debug_info.append("PageRangeProvider: No current page found, returning None")
        with open("/tmp/page_range_debug.txt", "a") as f:
            f.write("\n".join(debug_info) + "\n\n")
        return None
    
    async def _format_page_content(self, pages: List[Page], current_page: int, session: AsyncSession) -> str:
        """Format pages into readable context with page markers"""
        if not pages:
            return ""
            
        content_parts = []
        
        for page in pages:
            page_marker = f"--- Page {page.page_number}"
            if page.page_number == current_page:
                page_marker += " (CURRENT)"
            page_marker += " ---"
            
            # Use preloaded blocks if available, otherwise fall back to query
            if page.blocks is not None:
                blocks = page.blocks
            else:
                blocks = await self.doc_repo.get_blocks_by_page(page.id, session)
            
            page_text_parts = []
            
            for block in blocks:
                if block.html_content:
                    block_text = self._strip_html(block.html_content)
                    if block_text.strip():
                        page_text_parts.append(block_text)
            
            page_text = " ".join(page_text_parts)
            
            with open("/tmp/page_range_debug.txt", "a") as f:
                f.write(f"Page {page.page_number}: {len(blocks)} blocks, {len(page_text)} chars\n")
            
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