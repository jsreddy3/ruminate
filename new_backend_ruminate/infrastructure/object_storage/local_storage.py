"""Local filesystem implementation of ObjectStorageInterface"""
import aiofiles
from pathlib import Path
from typing import BinaryIO, Optional
from new_backend_ruminate.domain.object_storage.storage_interface import ObjectStorageInterface


class LocalObjectStorage(ObjectStorageInterface):
    """Local filesystem storage implementation"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    async def upload_file(self, file: BinaryIO, key: str, content_type: Optional[str] = None) -> str:
        """Upload a file to local filesystem"""
        file_path = self.base_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Read file content
        file.seek(0)
        content = file.read()
        
        # Write to local filesystem
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        return str(file_path)
    
    async def download_file(self, key: str) -> bytes:
        """Download a file from local filesystem"""
        file_path = self.base_path / key
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {key}")
        
        async with aiofiles.open(file_path, 'rb') as f:
            content = await f.read()
        
        return content
    
    async def delete_file(self, key: str) -> bool:
        """Delete a file from local filesystem"""
        file_path = self.base_path / key
        
        if file_path.exists():
            file_path.unlink()
            return True
        
        return False
    
    async def file_exists(self, key: str) -> bool:
        """Check if a file exists in local filesystem"""
        file_path = self.base_path / key
        return file_path.exists()
    
    async def get_presigned_url(self, key: str, expiration: int = 3600) -> str:
        """
        Generate a file:// URL for local files.
        Note: expiration is ignored for local files.
        """
        file_path = self.base_path / key
        return f"file://{file_path.absolute()}"