# new_backend_ruminate/infrastructure/document_processing/llm_document_analyzer.py
from typing import List
import re

from new_backend_ruminate.domain.ports.document_analyzer import DocumentAnalyzer
from new_backend_ruminate.domain.ports.llm import LLMService
from new_backend_ruminate.domain.document.entities.block import Block
from new_backend_ruminate.domain.conversation.entities.message import Message, Role


class LLMDocumentAnalyzer(DocumentAnalyzer):
    """Implementation of DocumentAnalyzer using LLM for analysis"""
    
    def __init__(self, llm: LLMService):
        self._llm = llm
    
    def _strip_html(self, html_content: str) -> str:
        """Remove HTML tags from content"""
        if not html_content:
            return ""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', html_content)
        # Clean up whitespace
        text = ' '.join(text.split())
        return text.strip()
    
    def _prepare_document_content(self, blocks: List[Block]) -> str:
        """Prepare document content from blocks for summarization"""
        content_parts = []
        
        for block in blocks:
            if block.html_content:
                text = self._strip_html(block.html_content)
                if text:  # Only add non-empty content
                    content_parts.append(text)
        
        return "\n\n".join(content_parts)
    
    async def generate_document_summary(
        self, 
        blocks: List[Block], 
        document_title: str
    ) -> str:
        """Generate a comprehensive summary of the document"""
        print(f"[LLMDocumentAnalyzer] Starting summary generation for '{document_title}' with {len(blocks)} blocks")
        
        # Prepare content
        document_content = self._prepare_document_content(blocks)
        print(f"[LLMDocumentAnalyzer] Prepared content length: {len(document_content)} chars")
        
        if not document_content:
            return f"Summary not available for '{document_title}'"
        
        # Create prompt for summary generation
        messages = [
            Message(
                role=Role.SYSTEM,
                content="""You are a document summarizer. Your task is to create a comprehensive summary of the provided document.
                
The summary should:
- Capture the main topics and key points
- Be 2-3 paragraphs long
- Use clear, concise language
- Focus on the most important information
- Maintain the document's original tone and perspective"""
            ),
            Message(
                role=Role.USER, 
                content=f"Document Title: {document_title}\n\nPlease summarize the following document:\n\n{document_content}"
            )
        ]
        
        # Generate summary using LLM
        print(f"[LLMDocumentAnalyzer] Calling LLM to generate summary...")
        try:
            summary = await self._llm.generate_response(messages)
            print(f"[LLMDocumentAnalyzer] LLM response received, length: {len(summary)} chars")
            return summary.strip()
        except Exception as e:
            print(f"[LLMDocumentAnalyzer] ERROR calling LLM: {type(e).__name__}: {str(e)}")
            import traceback
            print(f"[LLMDocumentAnalyzer] Traceback: {traceback.format_exc()}")
            raise