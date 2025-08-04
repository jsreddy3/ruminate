# new_backend_ruminate/context/windowed/builder.py

from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.conversation.entities.message import Message
from new_backend_ruminate.context.windowed.context_window import ContextWindow
from new_backend_ruminate.context.windowed.providers import (
    SystemPromptProvider,
    DocumentSummaryProvider,
    PageRangeProvider,
    ConversationHistoryProvider
)
from new_backend_ruminate.context.windowed.providers.chunk_summary import ChunkSummaryProvider
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface
from new_backend_ruminate.services.chunk import ChunkService


class WindowedContextBuilder:
    """Enhanced context builder with chunk summaries for document-focused conversations"""
    
    def __init__(
        self, 
        doc_repo: DocumentRepositoryInterface, 
        page_radius: int = 3,
        chunk_service: Optional[ChunkService] = None
    ):
        self.system_prompt_provider = SystemPromptProvider(doc_repo)
        self.document_summary_provider = DocumentSummaryProvider(doc_repo)
        self.page_range_provider = PageRangeProvider(doc_repo, page_radius=page_radius)
        self.conversation_history_provider = ConversationHistoryProvider(doc_repo)
        
        # Initialize chunk summary provider if chunk service is provided
        if chunk_service:
            self.chunk_summary_provider = ChunkSummaryProvider(doc_repo, chunk_service)
        else:
            self.chunk_summary_provider = None
    
    async def build(
        self, 
        conv: Conversation, 
        thread: List[Message], 
        *, 
        session: AsyncSession
    ) -> List[Dict[str, str]]:
        """
        Build enhanced context window with chunk summaries and return LLM-ready messages.
        
        Compatible interface with existing ContextBuilder for drop-in replacement.
        """
        # Build all parts concurrently for efficiency
        system_prompt = await self.system_prompt_provider.get_system_prompt(
            conv, session=session
        )
        document_summary = await self.document_summary_provider.get_document_summary(
            conv, session=session
        )
        
        # Get chunk summaries if available
        chunk_summaries = ""
        if self.chunk_summary_provider:
            try:
                chunk_summaries = await self.chunk_summary_provider.get_chunk_summaries(
                    conv, thread, session=session
                )
            except Exception as e:
                print(f"[WindowedContextBuilder] Warning: Failed to get chunk summaries: {e}")
                # Continue without chunk summaries
        
        page_content = await self.page_range_provider.get_page_content(
            conv, thread, session=session
        )
        conversation_history = await self.conversation_history_provider.render_conversation_history(
            conv, thread, session=session
        )
        
        # Debug output to file
        with open("/tmp/context_debug.txt", "a") as f:
            f.write(f"=== Context Build Debug ===\n")
            f.write(f"Conv ID: {conv.id}\n")
            f.write(f"Conv Type: {conv.type}\n") 
            f.write(f"Document ID: {conv.document_id}\n")
            f.write(f"Source Block ID: {conv.source_block_id}\n")
            f.write(f"Thread length: {len(thread)}\n")
            f.write(f"System prompt length: {len(system_prompt) if system_prompt else 0}\n")
            f.write(f"Document summary length: {len(document_summary) if document_summary else 0}\n")
            f.write(f"Chunk summaries length: {len(chunk_summaries) if chunk_summaries else 0}\n")
            f.write(f"Page content length: {len(page_content) if page_content else 0}\n")
            f.write(f"Conversation history length: {len(conversation_history) if conversation_history else 0}\n")
            f.write(f"Page content preview: {page_content[:200] if page_content else 'EMPTY'}...\n")
            f.write("===========================\n\n")
        
        # Create context window and convert to LLM format
        window = ContextWindow(
            system_prompt=system_prompt,
            document_summary=document_summary,
            chunk_summaries=chunk_summaries,
            page_content=page_content,
            conversation_history=conversation_history
        )
        
        return window.to_llm_messages()