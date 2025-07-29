# new_backend_ruminate/context/question_generation_builder.py
"""
Context builder specifically for generating contextual questions about documents.
Unlike conversation context, this focuses on content discovery and exploration.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.infrastructure.document.models import DocumentModel, BlockModel, PageModel


class QuestionGenerationContextBuilder:
    """
    Builds context for generating questions about document content.
    
    This differs from conversation context by:
    - Focusing on document structure and content
    - Including surrounding pages for broader context
    - Excluding conversation history (fresh perspective)
    - Emphasizing content discovery over dialogue continuity
    """
    
    def __init__(self, document_repo):
        self.document_repo = document_repo
    
    async def build_document_context(
        self,
        document_id: str,
        current_page: Optional[int] = None,
        context_window: int = 2,
        *,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """
        Build context for question generation about a document.
        
        Args:
            document_id: ID of the document
            current_page: Current page number (if user is reading specific page)
            context_window: Number of pages before/after to include
            session: Database session
            
        Returns:
            Dictionary with structured context for question generation
        """
        
        # Get document metadata
        document = await self.document_repo.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Get all pages for the document
        pages = await self._get_document_pages(document_id, session)
        
        # Determine which pages to include in context
        target_pages = self._select_context_pages(pages, current_page, context_window)
        
        # Get blocks for the selected pages
        blocks_by_page = await self._get_blocks_for_pages(
            document_id, [p.page_number for p in target_pages], session
        )
        
        # Build structured context
        context = {
            "document": {
                "title": getattr(document, 'title', 'Document'),
                "total_pages": len(pages),
                "document_type": getattr(document, 'status', 'unknown'),
            },
            "current_focus": {
                "page_number": current_page,
                "is_specific_page": current_page is not None
            },
            "content_sections": self._organize_content_by_sections(blocks_by_page, target_pages),
            "document_structure": self._analyze_document_structure(blocks_by_page),
            "key_topics": self._extract_key_topics(blocks_by_page)
        }
        
        return context
    
    async def _get_document_pages(self, document_id: str, session: AsyncSession) -> List[PageModel]:
        """Get all pages for a document, ordered by page number."""
        # This would use your document repository to get pages
        # Adapting to your existing repository pattern
        return await self.document_repo.get_pages_by_document(document_id, session)
    
    def _select_context_pages(
        self, 
        all_pages: List[PageModel], 
        current_page: Optional[int], 
        context_window: int
    ) -> List[PageModel]:
        """
        Select which pages to include in question generation context.
        
        If current_page is specified, include surrounding pages.
        Otherwise, include a representative sample of the document.
        """
        if not all_pages:
            return []
        
        if current_page is None:
            # No specific page - sample the document structure
            return self._sample_document_pages(all_pages)
        
        # Include current page + surrounding context
        start_page = max(1, current_page - context_window)
        end_page = min(len(all_pages), current_page + context_window)
        
        return [p for p in all_pages if start_page <= p.page_number <= end_page]
    
    def _sample_document_pages(self, pages: List[PageModel]) -> List[PageModel]:
        """
        Sample pages to get a representative view of the document.
        Includes beginning, middle, and end sections.
        """
        if len(pages) <= 5:
            return pages
        
        # Take first 2 pages, middle 2 pages, last 2 pages
        sampled = []
        sampled.extend(pages[:2])  # Beginning
        
        mid_start = len(pages) // 2 - 1
        mid_end = len(pages) // 2 + 1
        sampled.extend(pages[mid_start:mid_end])  # Middle
        
        sampled.extend(pages[-2:])  # End
        
        return sampled
    
    async def _get_blocks_for_pages(
        self, 
        document_id: str, 
        page_numbers: List[int], 
        session: AsyncSession
    ) -> Dict[int, List[BlockModel]]:
        """Get blocks grouped by page number."""
        blocks_by_page = {}
        
        # First get all pages to have page IDs
        all_pages = await self._get_document_pages(document_id, session)
        page_id_map = {p.page_number: p.id for p in all_pages}
        
        for page_num in page_numbers:
            if page_num in page_id_map:
                page_id = page_id_map[page_num]
                blocks = await self.document_repo.get_blocks_by_page(page_id, session)
                blocks_by_page[page_num] = blocks or []
            else:
                blocks_by_page[page_num] = []
        
        return blocks_by_page
    
    def _organize_content_by_sections(
        self, 
        blocks_by_page: Dict[int, List[BlockModel]], 
        pages: List[PageModel]
    ) -> List[Dict[str, Any]]:
        """
        Organize content into logical sections for question generation.
        """
        sections = []
        
        for page in pages:
            page_blocks = blocks_by_page.get(page.page_number, [])
            
            # Group blocks by type and extract key content
            text_blocks = [b for b in page_blocks if b.block_type.lower() in ['text', 'paragraph', 'heading']]
            figure_blocks = [b for b in page_blocks if b.block_type.lower() in ['figure', 'image', 'picture']]
            table_blocks = [b for b in page_blocks if b.block_type.lower() == 'table']
            
            section = {
                "page_number": page.page_number,
                "text_content": self._extract_text_content(text_blocks),
                "has_figures": len(figure_blocks) > 0,
                "has_tables": len(table_blocks) > 0,
                "block_types": list(set(b.block_type for b in page_blocks))
            }
            
            sections.append(section)
        
        return sections
    
    def _extract_text_content(self, text_blocks: List[BlockModel]) -> str:
        """Extract and clean text content from blocks."""
        content_parts = []
        
        for block in text_blocks:
            if hasattr(block, 'html_content') and block.html_content:
                # Simple HTML tag removal - could be more sophisticated
                import re
                clean_text = re.sub(r'<[^>]+>', '', block.html_content)
                clean_text = clean_text.strip()
                if clean_text:
                    content_parts.append(clean_text)
        
        return ' '.join(content_parts)
    
    def _analyze_document_structure(self, blocks_by_page: Dict[int, List[BlockModel]]) -> Dict[str, Any]:
        """
        Analyze the structure of the document to inform question types.
        """
        all_blocks = []
        for blocks in blocks_by_page.values():
            all_blocks.extend(blocks)
        
        block_types = {}
        for block in all_blocks:
            block_type = block.block_type.lower()
            block_types[block_type] = block_types.get(block_type, 0) + 1
        
        return {
            "total_blocks": len(all_blocks),
            "block_type_distribution": block_types,
            "has_headings": any('heading' in bt for bt in block_types.keys()),
            "has_figures": any('figure' in bt or 'image' in bt for bt in block_types.keys()),
            "has_tables": 'table' in block_types,
            "has_equations": any('equation' in bt or 'math' in bt for bt in block_types.keys()),
        }
    
    def _extract_key_topics(self, blocks_by_page: Dict[int, List[BlockModel]]) -> List[str]:
        """
        Extract key topics and concepts from the content.
        This is a simple implementation - could be enhanced with NLP.
        """
        # Simple keyword extraction based on heading blocks and repeated terms
        topics = []
        
        for blocks in blocks_by_page.values():
            for block in blocks:
                if hasattr(block, 'block_type') and 'heading' in block.block_type.lower():
                    if hasattr(block, 'html_content') and block.html_content:
                        import re
                        heading_text = re.sub(r'<[^>]+>', '', block.html_content).strip()
                        if heading_text and len(heading_text) < 100:  # Reasonable heading length
                            topics.append(heading_text)
        
        return topics[:10]  # Limit to top 10 topics
    
    def format_for_llm(self, context: Dict[str, Any]) -> str:
        """
        Format the context into a prompt suitable for LLM question generation.
        """
        doc_info = context["document"]
        focus_info = context["current_focus"]
        sections = context["content_sections"]
        structure = context["document_structure"]
        topics = context["key_topics"]
        
        prompt_parts = []
        
        # Document overview
        prompt_parts.append(f"Document: {doc_info['title']}")
        prompt_parts.append(f"Type: {doc_info['document_type']}")
        prompt_parts.append(f"Total pages: {doc_info['total_pages']}")
        
        # Current focus
        if focus_info["is_specific_page"]:
            prompt_parts.append(f"Current focus: Page {focus_info['page_number']}")
        else:
            prompt_parts.append("Context: Full document overview")
        
        # Document structure
        prompt_parts.append(f"\nDocument contains: {', '.join(structure['block_type_distribution'].keys())}")
        
        # Key topics
        if topics:
            prompt_parts.append(f"Key topics: {', '.join(topics)}")
        
        # Content sections
        prompt_parts.append("\nContent sections:")
        for section in sections:
            prompt_parts.append(f"Page {section['page_number']}: {section['text_content'][:200]}...")
        
        return '\n'.join(prompt_parts)