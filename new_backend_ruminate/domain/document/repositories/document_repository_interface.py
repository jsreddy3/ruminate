from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.document.entities import Document, Page, Block


class DocumentRepositoryInterface(ABC):
    """Interface for document repository operations"""
    
    @abstractmethod
    async def create_document(self, document: Document, session: AsyncSession) -> Document:
        """Create a new document"""
        pass
    
    @abstractmethod
    async def get_document(self, document_id: str, session: AsyncSession) -> Optional[Document]:
        """Get a document by ID"""
        pass
    
    @abstractmethod
    async def get_documents_by_user(self, user_id: str, session: AsyncSession) -> List[Document]:
        """Get all documents for a user"""
        pass
    
    @abstractmethod
    async def update_document(self, document: Document, session: AsyncSession) -> Document:
        """Update an existing document"""
        pass
    
    @abstractmethod
    async def delete_document(self, document_id: str, session: AsyncSession) -> bool:
        """Delete a document"""
        pass
    
    # Page operations
    @abstractmethod
    async def create_pages(self, pages: List[Page], session: AsyncSession) -> List[Page]:
        """Create multiple pages"""
        pass
    
    @abstractmethod
    async def get_pages_by_document(self, document_id: str, session: AsyncSession) -> List[Page]:
        """Get all pages for a document"""
        pass
    
    @abstractmethod
    async def get_page(self, page_id: str, session: AsyncSession) -> Optional[Page]:
        """Get a specific page"""
        pass
    
    # Block operations
    @abstractmethod
    async def create_blocks(self, blocks: List[Block], session: AsyncSession) -> List[Block]:
        """Create multiple blocks"""
        pass
    
    @abstractmethod
    async def get_blocks_by_document(self, document_id: str, session: AsyncSession) -> List[Block]:
        """Get all blocks for a document"""
        pass
    
    @abstractmethod
    async def get_blocks_by_page(self, page_id: str, session: AsyncSession) -> List[Block]:
        """Get all blocks for a page"""
        pass
    
    @abstractmethod
    async def get_block(self, block_id: str, session: AsyncSession) -> Optional[Block]:
        """Get a specific block"""
        pass
    
    @abstractmethod
    async def update_block(self, block: Block, session: AsyncSession) -> Block:
        """Update a block (for critical content analysis)"""
        pass
    
    @abstractmethod
    async def get_critical_blocks(self, document_id: str, session: AsyncSession) -> List[Block]:
        """Get all critical blocks for a document"""
        pass
    
    @abstractmethod
    async def get_pages_in_range(
        self, 
        document_id: str, 
        center_page: int, 
        radius: int, 
        session: AsyncSession
    ) -> List[Page]:
        """Get pages in range [center_page - radius, center_page + radius]"""
        pass
    
    @abstractmethod
    async def get_pages_in_range_with_blocks(
        self, 
        document_id: str, 
        center_page: int, 
        radius: int, 
        session: AsyncSession
    ) -> List[Page]:
        """Get pages in range with their blocks eagerly loaded (fixes N+1 query)"""
        pass