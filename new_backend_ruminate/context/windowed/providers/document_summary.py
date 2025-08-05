# new_backend_ruminate/context/windowed/providers/document_summary.py

import json
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface


class DocumentSummaryProvider:
    """Provides document summaries and info for context"""
    
    def __init__(self, doc_repo: DocumentRepositoryInterface):
        self.doc_repo = doc_repo
    
    async def get_document_summary(
        self, 
        conv: Conversation, 
        *, 
        session: AsyncSession
    ) -> str:
        """Get document summary and info if conversation is associated with a document"""
        if not conv.document_id:
            return ""
            
        document = await self.doc_repo.get_document(conv.document_id, session)
        if not document:
            return ""
        
        parts = []
        
        # Include document info if available
        if document.document_info:
            try:
                info_data = json.loads(document.document_info)
                
                # Add title and author if available
                if info_data.get("title"):
                    parts.append(f"**Title:** {info_data['title']}")
                if info_data.get("author") and info_data["author"] != "Unknown":
                    parts.append(f"**Author:** {info_data['author']}")
                
                # Add document info description
                if info_data.get("document_info"):
                    parts.append(f"\n**About this document:**\n{info_data['document_info']}")
                    
            except (json.JSONDecodeError, KeyError) as e:
                print(f"[DocumentSummaryProvider] Failed to parse document_info: {e}")
        
        # Add document summary
        if document.summary:
            if parts:  # Add separator if we have info above
                parts.append("\n**Summary:**")
            parts.append(document.summary)
            
        return "\n".join(parts) if parts else ""