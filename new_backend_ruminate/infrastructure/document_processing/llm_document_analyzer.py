# new_backend_ruminate/infrastructure/document_processing/llm_document_analyzer.py
from typing import List, Dict, Any
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
    
    async def generate_document_info(
        self, 
        blocks: List[Block], 
        current_title: str
    ) -> Dict[str, Any]:
        """Extract structured information about the document"""
        print(f"[LLMDocumentAnalyzer] Starting document info extraction for '{current_title}' with {len(blocks)} blocks")
        
        # Prepare content from first 5 pages worth of blocks
        content_parts = []
        pages_seen = set()
        
        for block in blocks:
            # Track pages (blocks have page_number attribute)
            if hasattr(block, 'page_number') and block.page_number is not None:
                # Check if we've seen 5 pages already
                if len(pages_seen) >= 5 and block.page_number not in pages_seen:
                    break
                pages_seen.add(block.page_number)
            
            # Add content from blocks in the first 5 pages
            if len(pages_seen) <= 5 and block.html_content:
                text = self._strip_html(block.html_content)
                if text:
                    content_parts.append(text)
        
        document_content = "\n\n".join(content_parts)
        print(f"[LLMDocumentAnalyzer] Prepared content from {len(pages_seen)} pages, length: {len(document_content)} chars")
        
        if not document_content:
            return {
                "document_info": f"Unable to extract information from '{current_title}'",
                "author": "Unknown",
                "title": current_title
            }
        
        # Define the JSON schema for structured output
        info_schema = {
            "type": "object",
            "properties": {
                "document_info": {
                    "type": "string",
                    "description": "Rich contextual information about the document including type, purpose, context, and any relevant background"
                },
                "author": {
                    "type": "string",
                    "description": "The author(s) of the document. Use 'Unknown' if not found"
                },
                "title": {
                    "type": "string",
                    "description": "A descriptive document title"
                }
            },
            "required": ["document_info", "author", "title"],
            "additionalProperties": False
        }
        
        # Create prompt for info extraction
        messages = [
            Message(
                role=Role.SYSTEM,
                content="""You are a document analyst extracting key information from documents.

Your task is to analyze the document and extract:
1. Document Info: Provide rich context about what kind of document this is, what it's about, its purpose, and any interesting background. If you find any summaries, include summaries! Be specific and informative.
2. Author: Extract the author name(s) if present. Look for bylines, signatures, or attribution. Use "Unknown" if not found.
3. Title: Suggest a descriptive title. For a book, paper, or generally pre-titled work, please use the official title. If you can't find a title, come up with a suitable one.

Base your analysis on the content provided from the first few pages of the document. Please output in JSON format."""
            ),
            Message(
                role=Role.USER,
                content=f"Current filename: {current_title}\n\nPlease analyze this document:\n\n{document_content}"
            )
        ]
        
        # Generate structured response using LLM
        print(f"[LLMDocumentAnalyzer] Calling LLM to extract document info...")
        try:
            result = await self._llm.generate_structured_response(
                messages=messages,
                response_format={"type": "json_object"},
                json_schema=info_schema
            )
            print(f"[LLMDocumentAnalyzer] Document info extracted successfully")
            return result
        except Exception as e:
            print(f"[LLMDocumentAnalyzer] ERROR extracting document info: {type(e).__name__}: {str(e)}")
            # Return fallback values
            return {
                "document_info": f"Error extracting information: {str(e)}",
                "author": "Unknown",
                "title": current_title
            }