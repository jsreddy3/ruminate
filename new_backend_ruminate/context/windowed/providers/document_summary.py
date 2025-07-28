# new_backend_ruminate/context/windowed/providers/document_summary.py

from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface


class DocumentSummaryProvider:
    """Provides document summaries for context"""
    
    def __init__(self, doc_repo: DocumentRepositoryInterface):
        self.doc_repo = doc_repo
    
    async def get_document_summary(
        self, 
        conv: Conversation, 
        *, 
        session: AsyncSession
    ) -> str:
        """Get document summary if conversation is associated with a document"""
        if not conv.document_id:
            return ""
            
        document = await self.doc_repo.get_document(conv.document_id, session)
        if not document:
            return ""
            
        return document.summary or ""