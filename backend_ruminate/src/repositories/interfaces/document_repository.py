from abc import ABC, abstractmethod
from typing import List, Optional, TypeVar
from src.models.base.document import Document
from src.models.viewer.page import Page
from src.models.viewer.block import Block
from src.models.base.chunk import Chunk

DBSession = TypeVar('DBSession')

class DocumentRepository(ABC):
    @abstractmethod
    async def store_document(self, document: Document, session: Optional[DBSession] = None) -> None:
        pass
        
    @abstractmethod
    async def get_document(self, document_id: str, session: Optional[DBSession] = None) -> Optional[Document]:
        """Get a document by ID"""
        pass
    
    @abstractmethod
    async def store_pages(self, pages: List[Page], session: Optional[DBSession] = None) -> None:
        pass
    
    @abstractmethod
    async def get_document_pages(self, document_id: str, session: Optional[DBSession] = None) -> List[Page]:
        pass
    
    @abstractmethod
    async def store_blocks(self, blocks: List[Block], session: Optional[DBSession] = None) -> None:
        pass
    
    @abstractmethod
    async def get_page_blocks(self, page_id: str, session: Optional[DBSession] = None) -> List[Block]:
        pass

    @abstractmethod
    async def get_blocks(self, document_id: str, session: Optional[DBSession] = None) -> List[Block]:
        pass
    
    @abstractmethod
    async def get_block(self, block_id: str, session: Optional[DBSession] = None) -> Optional[Block]:
        """Get a block by ID"""
        pass

    @abstractmethod
    async def store_chunks(self, chunks: List[Chunk], session: Optional[DBSession] = None) -> None:
        """Store document chunks in the database"""
        pass
        
    @abstractmethod
    async def get_chunks(self, document_id: str, session: Optional[DBSession] = None) -> List[Chunk]:
        """Get all chunks for a document"""
        pass
        
    @abstractmethod
    async def get_chunk(self, chunk_id: str, session: Optional[DBSession] = None) -> Optional[Chunk]:
        """Get a specific chunk by ID"""
        pass
        
    @abstractmethod
    async def update_document_arguments(self, document_id: str, arguments: List[dict], session: Optional[DBSession] = None) -> None:
        """Update the arguments for a document
        
        Args:
            document_id: ID of the document to update
            arguments: List of argument dictionaries to save
            session: Optional database session
        """
        pass
        
    @abstractmethod
    async def update_document_key_themes_terms(self, document_id: str, key_themes_terms: List[dict], session: Optional[DBSession] = None) -> None:
        """Update the key themes and terms for a document
        
        Args:
            document_id: ID of the document to update
            key_themes_terms: List of key theme/term dictionaries to save
            session: Optional database session
        """
        pass