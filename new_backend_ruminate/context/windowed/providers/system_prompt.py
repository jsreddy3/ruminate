# new_backend_ruminate/context/windowed/providers/system_prompt.py

from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.context.prompts import default_system_prompts, agent_system_prompt
from new_backend_ruminate.domain.ports.tool import tool_registry
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface


class SystemPromptProvider:
    """Provides system prompts based on conversation type"""
    
    def __init__(self, doc_repo: DocumentRepositoryInterface):
        self.doc_repo = doc_repo
    
    async def get_system_prompt(
        self, 
        conv: Conversation, 
        *, 
        session: AsyncSession
    ) -> str:
        """Get appropriate system prompt for conversation type"""
        conv_type = conv.type.value.lower() if hasattr(conv.type, 'value') else conv.type.lower()
        
        if conv_type == "agent":
            return agent_system_prompt(list(tool_registry.values()))
        elif conv_type == "rabbithole":
            return await self._format_rabbithole_prompt(conv, session=session)
        else:
            return default_system_prompts.get(conv_type, default_system_prompts["chat"])
    
    async def _format_rabbithole_prompt(
        self, 
        conv: Conversation, 
        *, 
        session: AsyncSession
    ) -> str:
        """Format rabbithole system prompt with selected text and context"""
        import re
        
        template = default_system_prompts["rabbithole"]
        
        # Get document information
        document = None
        if conv.document_id:
            document = await self.doc_repo.get_document(conv.document_id, session)
        
        # Get block context if available
        block_context = ""
        if conv.source_block_id:
            block = await self.doc_repo.get_block(conv.source_block_id, session)
            if block and block.html_content:
                # Strip HTML tags
                block_content = re.sub(r'<[^>]+>', ' ', block.html_content)
                block_content = ' '.join(block_content.split()).strip()
                block_type = block.block_type.value if hasattr(block.block_type, 'value') else str(block.block_type)
                block_context = f"\nThe selected text is from a block of type '{block_type}' with context:\n{block_content}\n"
        
        # Build document summary section
        document_summary = ""
        if document and document.summary:
            document_summary = f"\nDocument Summary:\n{document.summary}\n"
            
        # Format the prompt template
        return template.format(
            selected_text=conv.selected_text or "", 
            block_context=block_context,
            document_summary=document_summary,
            document_title=document.title if document else "Untitled Document"
        )