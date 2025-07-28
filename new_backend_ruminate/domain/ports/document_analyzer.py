# new_backend_ruminate/domain/ports/document_analyzer.py
from abc import ABC, abstractmethod
from typing import List

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