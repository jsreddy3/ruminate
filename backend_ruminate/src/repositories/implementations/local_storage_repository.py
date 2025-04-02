from typing import Optional
import os
from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.interfaces.storage_repository import StorageRepository

class LocalStorageRepository(StorageRepository):
    """Local filesystem implementation of StorageRepository."""
    
    def __init__(self, storage_dir: str = "local_storage"):
        """Initialize local storage repository.
        
        Args:
            storage_dir: Directory to store files in
        """
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
    
    async def store_file(self, file_data: bytes, document_id: str, session: Optional[AsyncSession] = None) -> str:
        """Store a file locally and return its path.
        
        Args:
            file_data: Raw bytes of the file
            document_id: Unique identifier for the document
            session: Unused session parameter
            
        Returns:
            str: Local path where file is stored
        """
        file_path = os.path.join(self.storage_dir, f"{document_id}.pdf")
        with open(file_path, "wb") as f:
            f.write(file_data)
        return file_path
    
    async def get_file(self, file_path: str, session: Optional[AsyncSession] = None) -> Optional[bytes]:
        """Retrieve a file from local storage.
        
        Args:
            file_path: Path to the file (returned from store_file)
            session: Unused session parameter
            
        Returns:
            bytes: Raw file data if found, None otherwise
        """
        if not os.path.exists(file_path):
            return None
            
        with open(file_path, "rb") as f:
            return f.read()
    
    async def delete_file(self, file_path: str, session: Optional[AsyncSession] = None) -> None:
        """Delete a file from local storage.
        
        Args:
            file_path: Path to the file (returned from store_file)
            session: Unused session parameter
        """
        if os.path.exists(file_path):
            os.remove(file_path)
