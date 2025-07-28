"""Factory for creating object storage instances based on configuration"""
from typing import Optional
from new_backend_ruminate.domain.object_storage.storage_interface import ObjectStorageInterface
from new_backend_ruminate.infrastructure.object_storage.local_storage import LocalObjectStorage
from new_backend_ruminate.infrastructure.object_storage.s3_storage import S3ObjectStorage
from new_backend_ruminate.config import settings


def get_object_storage() -> ObjectStorageInterface:
    """
    Factory function to get the appropriate storage implementation
    based on configuration settings.
    """
    config = settings()
    
    if config.storage_type == "s3":
        if not config.s3_bucket_name:
            raise ValueError("S3 bucket name is required when storage_type is 's3'")
        
        return S3ObjectStorage(
            bucket_name=config.s3_bucket_name,
            region=config.s3_region,
            aws_access_key_id=config.aws_access_key_id,
            aws_secret_access_key=config.aws_secret_access_key
        )
    
    elif config.storage_type == "local":
        return LocalObjectStorage(base_path=config.local_storage_path)
    
    else:
        raise ValueError(f"Unknown storage type: {config.storage_type}")


# Singleton instance - reuse the same storage instance
_storage_instance: Optional[ObjectStorageInterface] = None


def get_object_storage_singleton() -> ObjectStorageInterface:
    """
    Get a singleton instance of the object storage.
    Useful for avoiding multiple connections to S3.
    """
    global _storage_instance
    
    if _storage_instance is None:
        _storage_instance = get_object_storage()
    
    return _storage_instance