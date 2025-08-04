# new_backend_ruminate/context/windowed/context_window.py

from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class ContextWindow:
    """Enhanced context window with chunk summaries for document-focused conversations"""
    system_prompt: str
    document_summary: str
    chunk_summaries: str = ""  # New field for chunk summaries
    page_content: str = ""
    conversation_history: List[Dict[str, str]] = None
    
    def to_llm_messages(self) -> List[Dict[str, str]]:
        """Convert context window to OpenAI message format"""
        messages = []
        
        # 1. System message with all context parts
        system_content = self._build_system_content()
        messages.append({"role": "system", "content": system_content})
        
        # 2. Conversation history
        if self.conversation_history:
            messages.extend(self.conversation_history)
        
        return messages
    
    def _build_system_content(self) -> str:
        """Combine system prompt, document summary, chunk summaries, and page content"""
        parts = [self.system_prompt]
        
        if self.document_summary and self.document_summary.strip():
            parts.append(f"\n## Document Summary\n{self.document_summary}")
        
        if self.chunk_summaries and self.chunk_summaries.strip():
            parts.append(f"\n## Document Sections Overview\n{self.chunk_summaries}")
            
        if self.page_content and self.page_content.strip():
            parts.append(f"\n## Current Page Context\n{self.page_content}")
            
        return "\n".join(parts)