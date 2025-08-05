# new_backend_ruminate/domain/ports/document_analyzer.py
from abc import ABC, abstractmethod
from typing import List, Dict, Any

from new_backend_ruminate.domain.document.entities.block import Block


class DocumentAnalyzer(ABC):
    """Port for document analysis capabilities"""
    
    @abstractmethod
    async def generate_document_summary(
        self, 
        blocks: List[Block], 
        document_title: str
    ) -> str:
        """
        Generate a comprehensive summary of the entire document.
        
        Args:
            blocks: List of document blocks containing the content
            document_title: Title of the document for context
            
        Returns:
            A comprehensive summary of the document
        """
        pass
    
    @abstractmethod
    async def generate_document_info(
        self, 
        blocks: List[Block], 
        current_title: str
    ) -> Dict[str, Any]:
        """
        Extract structured information about the document including author, 
        suggested title, and contextual information.
        
        Args:
            blocks: List of document blocks (typically first 5 pages)
            current_title: Current title (usually filename) for context
            
        Returns:
            Dictionary containing:
            - document_info: Rich contextual information about the document
            - author: Extracted author name(s)
            - title: Suggested title for the document
        """
        pass