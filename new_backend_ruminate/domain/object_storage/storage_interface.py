from abc import ABC, abstractmethod
from typing import BinaryIO, Optional


class ObjectStorageInterface(ABC):
    """Interface for object storage operations (S3, local filesystem, etc.)"""
    
    @abstractmethod
    async def upload_file(self, file: BinaryIO, key: str, content_type: Optional[str] = None) -> str:
        """
        Upload a file to storage
        
        Args:
            file: File-like object to upload
            key: Storage key/path for the file
            content_type: MIME type of the file
            
        Returns:
            The storage path/URL of the uploaded file
        """
        pass
    
    @abstractmethod
    async def download_file(self, key: str) -> bytes:
        """
        Download a file from storage
        
        Args:
            key: Storage key/path of the file
            
        Returns:
            File contents as bytes
        """
        pass
    
    @abstractmethod
    async def delete_file(self, key: str) -> bool:
        """
        Delete a file from storage
        
        Args:
            key: Storage key/path of the file
            
        Returns:
            True if deletion was successful
        """
        pass
    
    @abstractmethod
    async def file_exists(self, key: str) -> bool:
        """
        Check if a file exists in storage
        
        Args:
            key: Storage key/path of the file
            
        Returns:
            True if file exists
        """
        pass
    
    @abstractmethod
    async def get_presigned_url(self, key: str, expiration: int = 3600) -> str:
        """
        Generate a presigned URL for temporary access
        
        Args:
            key: Storage key/path of the file
            expiration: URL expiration time in seconds
            
        Returns:
            Presigned URL
        """
        pass
    
    @abstractmethod
    async def generate_presigned_post(self, key: str, content_type: Optional[str] = None, expires_in: int = 3600) -> dict:
        """
        Generate a presigned POST URL and fields for direct upload
        
        Args:
            key: Storage key/path where the file will be uploaded
            content_type: MIME type of the file to be uploaded
            expires_in: URL expiration time in seconds
            
        Returns:
            Dictionary with 'url' and 'fields' for the POST request
        """
        pass