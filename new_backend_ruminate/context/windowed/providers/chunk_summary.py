# new_backend_ruminate/context/windowed/providers/chunk_summary.py

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface
from new_backend_ruminate.services.chunk import ChunkService


class ChunkSummaryProvider:
    """Provides chunk summaries for context up to the current page"""
    
    def __init__(
        self, 
        doc_repo: DocumentRepositoryInterface,
        chunk_service: ChunkService
    ):
        """
        Args:
            doc_repo: Document repository for data access
            chunk_service: Service for chunk operations
        """
        self.doc_repo = doc_repo
        self.chunk_service = chunk_service
    
    async def get_chunk_summaries(
        self, 
        conv: Conversation, 
        thread: List[Message], 
        *, 
        session: AsyncSession
    ) -> str:
        """Get chunk summaries up to the current page"""
        if not conv.document_id:
            return ""
        
        # Derive current page from conversation/messages
        current_page = await self._derive_current_page(conv, thread, session=session)
        if current_page is None:
            return ""
        
        # Get or generate chunk summaries up to current page
        chunk_summaries = await self.chunk_service.get_or_generate_chunk_summaries(
            document_id=conv.document_id,
            up_to_page=current_page,
            session=session
        )
        
        if not chunk_summaries:
            return ""
        
        # Format chunk summaries
        return self._format_chunk_summaries(chunk_summaries)
    
    async def _derive_current_page(
        self, 
        conv: Conversation, 
        thread: List[Message], 
        *, 
        session: AsyncSession
    ) -> Optional[int]:
        """Derive current page from conversation context"""
        from new_backend_ruminate.domain.conversation.entities.conversation import ConversationType
        
        if conv.type == ConversationType.RABBITHOLE:
            # Rabbithole conversations have fixed page context
            if conv.source_block_id:
                block = await self.doc_repo.get_block(conv.source_block_id, session)
                if block and block.page_number is not None:
                    return block.page_number
        else:
            # Normal conversations - check messages for block_id
            for msg in reversed(thread):
                # Handle both string and enum role types
                role_value = msg.role.value if hasattr(msg.role, 'value') else msg.role
                if role_value == "user" and msg.block_id:
                    block = await self.doc_repo.get_block(msg.block_id, session)
                    if block and block.page_number is not None:
                        return block.page_number
            
            # Fallback to conversation's source_block_id
            if conv.source_block_id:
                block = await self.doc_repo.get_block(conv.source_block_id, session)
                if block and block.page_number is not None:
                    return block.page_number
        
        return None
    
    def _format_chunk_summaries(self, chunk_summaries: List[tuple]) -> str:
        """Format chunk summaries into readable text"""
        if not chunk_summaries:
            return ""
        
        formatted_parts = []
        formatted_parts.append("=== Document Section Summaries ===\n")
        
        for chunk, summary in chunk_summaries:
            if summary:
                section_header = f"Pages {chunk.start_page}-{chunk.end_page - 1}:"
                formatted_parts.append(f"{section_header} {summary}")
        
        return "\n\n".join(formatted_parts)