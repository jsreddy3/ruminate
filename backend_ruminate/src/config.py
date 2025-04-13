from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional
from src.repositories.factory import StorageType

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    # API Keys
    OPENAI_API_KEY: str
    DATALAB_API_KEY: str
    GEMINI_API_KEY: str
    GOOGLE_API_KEY: str
    
    # Storage type settings
    DOCUMENT_STORAGE_TYPE: str = "sqlite"  # Default to SQLite storage
    FILE_STORAGE_TYPE: str = "local"      # Default to local file storage
    
    # Local storage settings
    STORAGE_DIR: str = "local_storage"     # Directory for file storage
    DATA_DIR: Optional[str] = None         # For compatibility with old config
    
    # SQLite settings
    DB_PATH: Optional[str] = "sqlite.db"   # Path to SQLite database
    
    # RDS settings - direct env var names
    RDS_DB_HOST: Optional[str] = None
    RDS_DB_PORT: Optional[int] = None
    RDS_MASTER_USERNAME: Optional[str] = None
    RDS_MASTER_PASSWORD: Optional[str] = None
    RDS_DB_NAME: Optional[str] = None
    
    # S3 settings
    AWS_ACCESS_KEY: Optional[str] = None
    AWS_SECRET_KEY: Optional[str] = None
    S3_BUCKET: Optional[str] = None

    class Config:
        env_file = [".env", "../.env"]  # Look in both current and parent directories
        env_file_encoding = "utf-8"
        
        # For compatibility with code that used lowercase properties
        populate_by_name = True

    def validate_storage_types(self):
        """Validate that required settings are present for chosen storage types."""
        # Validate document storage settings
        if self.DOCUMENT_STORAGE_TYPE == StorageType.SQLITE.value:
            if not self.DB_PATH:
                raise ValueError("DB_PATH must be set when using sqlite storage")
        elif self.DOCUMENT_STORAGE_TYPE == StorageType.RDS.value:
            # Check each RDS setting individually for better error messages
            missing_settings = []
            if not self.RDS_DB_HOST:
                missing_settings.append("RDS_DB_HOST")
            if self.RDS_DB_PORT is None:  # Check for None specifically since port is an int
                missing_settings.append("RDS_DB_PORT")
            if not self.RDS_MASTER_USERNAME:
                missing_settings.append("RDS_MASTER_USERNAME")
            if not self.RDS_MASTER_PASSWORD:
                missing_settings.append("RDS_MASTER_PASSWORD")
            if not self.RDS_DB_NAME:
                missing_settings.append("RDS_DB_NAME")
                
            if missing_settings:
                raise ValueError(f"Missing required RDS settings: {', '.join(missing_settings)}")
                
        # Validate file storage settings
        if self.FILE_STORAGE_TYPE == StorageType.S3.value:
            if not all([self.AWS_ACCESS_KEY, self.AWS_SECRET_KEY, self.S3_BUCKET]):
                raise ValueError("All S3 settings must be set when using S3 storage")

    # Properties for backward compatibility
    @property
    def openai_api_key(self):
        return self.OPENAI_API_KEY
        
    @property
    def datalab_api_key(self):
        return self.DATALAB_API_KEY
        
    @property
    def gemini_api_key(self):
        return self.GEMINI_API_KEY
        
    @property
    def document_storage_type(self):
        return self.DOCUMENT_STORAGE_TYPE
        
    @property
    def file_storage_type(self):
        return self.FILE_STORAGE_TYPE
        
    @property
    def storage_dir(self):
        return self.STORAGE_DIR
        
    @property
    def db_path(self):
        return self.DB_PATH
        
    @property
    def db_host(self):
        return self.RDS_DB_HOST
        
    @property
    def db_port(self):
        return self.RDS_DB_PORT
        
    @property
    def db_user(self):
        return self.RDS_MASTER_USERNAME
        
    @property
    def db_password(self):
        return self.RDS_MASTER_PASSWORD
        
    @property
    def db_name(self):
        return self.RDS_DB_NAME
        
    @property
    def aws_access_key(self):
        return self.AWS_ACCESS_KEY
        
    @property
    def aws_secret_key(self):
        return self.AWS_SECRET_KEY
        
    @property
    def s3_bucket(self):
        return self.S3_BUCKET

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    settings.validate_storage_types()
    return settings