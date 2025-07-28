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
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface


class WindowedContextBuilder:
    """Four-part context builder for document-focused conversations"""
    
    def __init__(self, doc_repo: DocumentRepositoryInterface, page_radius: int = 3):
        self.system_prompt_provider = SystemPromptProvider(doc_repo)
        self.document_summary_provider = DocumentSummaryProvider(doc_repo)
        self.page_range_provider = PageRangeProvider(doc_repo, page_radius=page_radius)
        self.conversation_history_provider = ConversationHistoryProvider(doc_repo)
    
    async def build(
        self, 
        conv: Conversation, 
        thread: List[Message], 
        *, 
        session: AsyncSession
    ) -> List[Dict[str, str]]:
        """
        Build four-part context window and return LLM-ready messages.
        
        Compatible interface with existing ContextBuilder for drop-in replacement.
        """
        # Build all four parts concurrently for efficiency
        system_prompt = await self.system_prompt_provider.get_system_prompt(
            conv, session=session
        )
        document_summary = await self.document_summary_provider.get_document_summary(
            conv, session=session
        )
        page_content = await self.page_range_provider.get_page_content(
            conv, thread, session=session
        )
        conversation_history = await self.conversation_history_provider.render_conversation_history(
            conv, thread, session=session
        )
        
        # Create context window and convert to LLM format
        window = ContextWindow(
            system_prompt=system_prompt,
            document_summary=document_summary,
            page_content=page_content,
            conversation_history=conversation_history
        )
        
        return window.to_llm_messages()