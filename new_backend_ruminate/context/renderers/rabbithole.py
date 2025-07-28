# new_backend_ruminate/context/renderers/rabbithole.py

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.conversation.entities.message import Message, Role
from new_backend_ruminate.domain.conversation.entities.conversation import Conversation
from new_backend_ruminate.infrastructure.document.models import DocumentModel, BlockModel
import re


def _strip_html(html_content: Optional[str]) -> str:
    """Simple text extraction from HTML content"""
    if not html_content:
        return ""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_content)
    # Clean up whitespace
    text = ' '.join(text.split())
    return text.strip()


async def rabbithole_system_renderer(
    msg: Message, 
    conv: Conversation, 
    *, 
    session: AsyncSession
) -> str:
    """
    Render system message for rabbithole conversation with document context
    """
    # Get document information
    document = await session.get(DocumentModel, conv.document_id)
    if not document:
        raise ValueError(f"Document {conv.document_id} not found")
    
    # Get block information if available
    block_context = ""
    if conv.source_block_id:
        block = await session.get(BlockModel, conv.source_block_id)
        if block and block.html_content:
            block_content = _strip_html(block.html_content)
            block_type = block.block_type or "text"
            block_context = f"\nThe selected text is from a block of type '{block_type}' with context:\n{block_content}\n"
    
    # Build document summary section
    document_summary = ""
    if document.summary:
        document_summary = f"\nDocument Summary:\n{document.summary}\n"
    
    # Format the prompt template
    prompt = msg.content.format(
        selected_text=conv.selected_text or "",
        block_context=block_context,
        document_summary=document_summary,
        document_title=document.title or "Untitled Document"
    )
    
    return prompt


async def rabbithole_user_renderer(msg: Message, *_, **__) -> str:
    """Standard user message renderer for rabbithole conversations"""
    return msg.content


async def rabbithole_assistant_renderer(msg: Message, *_, **__) -> str:
    """Standard assistant message renderer for rabbithole conversations"""
    return msg.content


async def rabbithole_tool_renderer(msg: Message, *_, **__) -> str:
    """Tool message renderer for rabbithole conversations (if needed)"""
    return msg.content