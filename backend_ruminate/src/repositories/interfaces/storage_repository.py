from abc import ABC, abstractmethod
from typing import Optional
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

class StorageRepository(ABC):
    """Interface for storage repositories"""

    @abstractmethod
    async def store_file(self, file_data: bytes, document_id: str, session: Optional[AsyncSession] = None) -> str:
        """Store raw file data and return path"""
        pass
        
    @abstractmethod
    async def get_file(self, file_path: str, session: Optional[AsyncSession] = None) -> Optional[bytes]:
        """Get a file's contents"""
        pass
        
    @abstractmethod
    async def delete_file(self, file_path: str, session: Optional[AsyncSession] = None) -> None:
        """Delete a file"""
        pass