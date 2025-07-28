# new_backend_ruminate/context/windowed/providers/conversation_history.py

from typing import List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation, ConversationType
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.document.repositories.document_repository_interface import DocumentRepositoryInterface
import re


class ConversationHistoryProvider:
    """Provides conversation history with special handling for rabbithole first messages"""
    
    def __init__(self, doc_repo: DocumentRepositoryInterface):
        self.doc_repo = doc_repo
    
    async def render_conversation_history(
        self, 
        conv: Conversation, 
        thread: List[Message], 
        *, 
        session: AsyncSession
    ) -> List[Dict[str, str]]:
        """Render conversation messages with special rabbithole handling"""
        messages = []
        
        for i, msg in enumerate(thread):
            # Handle both string and enum role types for comparisons
            role_value = msg.role.value if hasattr(msg.role, 'value') else msg.role
            
            # Skip system messages - they're handled in ContextWindow
            if role_value == "SYSTEM" or role_value == "system":
                continue
                
            # Special handling for first user message in rabbithole conversations
            if (conv.type == ConversationType.RABBITHOLE and 
                (role_value == "USER" or role_value == "user") and 
                i == 1):  # First user message after system
                content = await self._enhance_rabbithole_first_message(conv, msg, session=session)
            else:
                content = msg.content
                
            # Handle both string and enum role types
            role_value = msg.role.value if hasattr(msg.role, 'value') else msg.role
            messages.append({
                "role": role_value.lower(),
                "content": content
            })
            
        return messages
    
    async def _enhance_rabbithole_first_message(
        self, 
        conv: Conversation, 
        msg: Message, 
        *, 
        session: AsyncSession
    ) -> str:
        """Enhance first user message in rabbithole with block context"""
        enhanced_content = msg.content
        
        # Add selected text context
        if conv.selected_text:
            enhanced_content = f"Regarding this selected text: \"{conv.selected_text}\"\n\n{enhanced_content}"
        
        # Add block context if available
        if conv.source_block_id:
            block = await self.doc_repo.get_block(conv.source_block_id, session)
            if block and block.html_content:
                block_content = self._strip_html(block.html_content)
                if block_content.strip():
                    enhanced_content += f"\n\n[Block context: {block_content[:200]}...]"
        
        return enhanced_content
    
    def _strip_html(self, html_content: str) -> str:
        """Simple text extraction from HTML content"""
        if not html_content:
            return ""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', html_content)
        # Clean up whitespace
        text = ' '.join(text.split())
        return text.strip()