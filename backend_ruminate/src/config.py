from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional
from src.repositories.factory import StorageType

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    # API Keys
    openai_api_key: str
    datalab_api_key: str
    gemini_api_key: str
    
    # Storage type settings
    document_storage_type: str = "sqlite"  # Default to local JSON storage
    file_storage_type: str = "local"      # Default to local file storage
    
    # Local storage settings
    data_dir: str = "local_db"            # Directory for JSON document storage
    storage_dir: str = "local_storage"     # Directory for file storage
    
    # SQLite settings
    db_path: Optional[str] = "sqlite.db"         # Path to SQLite database
    
    # RDS settings
    db_host: Optional[str] = None
    db_port: Optional[int] = None
    db_user: Optional[str] = None
    db_password: Optional[str] = None
    
    # S3 settings
    aws_access_key: Optional[str] = None
    aws_secret_key: Optional[str] = None
    s3_bucket: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def validate_storage_types(self):
        """Validate that required settings are present for chosen storage types."""
        # Validate document storage settings
        if self.document_storage_type == StorageType.SQLITE.value:
            if not self.db_path:
                raise ValueError("db_path must be set when using sqlite storage")
        elif self.document_storage_type == StorageType.RDS.value:
            if not all([self.db_host, self.db_port, self.db_user, self.db_password]):
                raise ValueError("All RDS settings must be set when using RDS storage")
                
        # Validate file storage settings
        if self.file_storage_type == StorageType.S3.value:
            if not all([self.aws_access_key, self.aws_secret_key, self.s3_bucket]):
                raise ValueError("All S3 settings must be set when using S3 storage")

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    settings.validate_storage_types()
    return settings