# repositories/interfaces/chunk_index_repository.py
from abc import ABC, abstractmethod
from typing import List, Optional
from src.models.rumination.chunk_index import ChunkIndex

class ChunkIndexRepository(ABC):
    """Interface for ChunkIndex repository operations"""
    
    @abstractmethod
    async def create_chunk_index(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Create a new chunk index"""
        pass
    
    @abstractmethod
    async def get_chunk_index(self, chunk_id: str) -> Optional[ChunkIndex]:
        """Get a chunk index by chunk ID"""
        pass
    
    @abstractmethod
    async def get_document_chunk_indices(self, document_id: str) -> List[ChunkIndex]:
        """Get all chunk indices for a document"""
        pass
    
    @abstractmethod
    async def update_chunk_index(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Update a chunk index"""
        pass
    
    @abstractmethod
    async def delete_chunk_index(self, chunk_id: str) -> None:
        """Delete a chunk index"""
        pass 