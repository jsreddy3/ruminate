from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from ..entities.text_enhancement import TextEnhancement, TextEnhancementType


class TextEnhancementRepositoryInterface(ABC):
    """Repository interface for unified text enhancements (definitions, annotations, rabbitholes)"""
    
    @abstractmethod
    async def create(self, enhancement: TextEnhancement, session: AsyncSession) -> TextEnhancement:
        """Create a new text enhancement"""
        pass
    
    @abstractmethod
    async def get(self, enhancement_id: str, session: AsyncSession) -> Optional[TextEnhancement]:
        """Get a text enhancement by ID"""
        pass
    
    @abstractmethod
    async def get_by_document(self, document_id: str, session: AsyncSession) -> List[TextEnhancement]:
        """Get all text enhancements for a document"""
        pass
    
    @abstractmethod
    async def get_by_block(self, block_id: str, session: AsyncSession) -> List[TextEnhancement]:
        """Get all text enhancements for a block"""
        pass
    
    @abstractmethod
    async def get_by_type(self, document_id: str, enhancement_type: TextEnhancementType, session: AsyncSession) -> List[TextEnhancement]:
        """Get all text enhancements of a specific type for a document"""
        pass
    
    @abstractmethod
    async def update(self, enhancement_id: str, updates: Dict[str, Any], session: AsyncSession) -> Optional[TextEnhancement]:
        """Update a text enhancement"""
        pass
    
    @abstractmethod
    async def delete(self, enhancement_id: str, session: AsyncSession) -> bool:
        """Delete a text enhancement"""
        pass
    
    @abstractmethod
    async def find_by_position(self, block_id: str, start_offset: int, end_offset: int, 
                              enhancement_type: Optional[TextEnhancementType], session: AsyncSession) -> Optional[TextEnhancement]:
        """Find a text enhancement by its position in a block"""
        pass
    
    @abstractmethod
    async def get_all_for_document_grouped(self, document_id: str, session: AsyncSession) -> Dict[str, List[TextEnhancement]]:
        """
        Get all text enhancements for a document, grouped by type.
        Returns: {
            "definitions": [...],
            "annotations": [...],
            "rabbitholes": [...]
        }
        """
        pass