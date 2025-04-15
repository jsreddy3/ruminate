"""
API dependencies module for FastAPI dependency injection.
"""
from functools import lru_cache
from typing import Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import Column, Integer
import logging

from src.database.base import Base
from src.repositories.factory import RepositoryFactory
from src.repositories.interfaces.document_repository import DocumentRepository
from src.repositories.interfaces.storage_repository import StorageRepository
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.services.document.upload_service import UploadService
from src.services.document.marker_service import MarkerService
from src.services.conversation.chat_service import ChatService
from src.services.ai.llm_service import LLMService
from src.config import get_settings, Settings
from src.services.document.critical_content_service import CriticalContentService

# Global instances
repository_factory = RepositoryFactory()
db_session_factory = None

logger = logging.getLogger(__name__)

async def initialize_repositories():
    """Called on app startup to initialize repositories"""
    global db_session_factory
    
    settings = get_settings()
    
    # Initialize session factory if using a database
    if settings.document_storage_type in ["rds", "sqlite"]:
        if settings.document_storage_type == "rds":
            url = f"postgresql+asyncpg://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
        else:  # sqlite
            url = f"sqlite+aiosqlite:///{settings.db_path}"
            
        try:
            # Reduce logging verbosity - change from echo=True to echo=False
            engine = create_async_engine(url, echo=False)
            db_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            
            # Import RDS models from their new locations
            from src.models.base.document import DocumentModel
            from src.models.viewer.page import PageModel
            from src.models.viewer.block import BlockModel
            from src.models.base.chunk import ChunkModel
            # Import conversation models
            from src.models.conversation.conversation import ConversationModel
            from src.models.conversation.message import MessageModel
            
            # # Create tables
            # async with engine.begin() as conn:
            #     # For PostgreSQL, drop and recreate tables for clean start
            #     if settings.document_storage_type == "rds":
            #         try:
            #             # Drop all tables first to ensure clean start with new schema
            #             await conn.run_sync(Base.metadata.drop_all)
            #             logger.info(f"Dropped existing tables for {settings.document_storage_type}")
                        
            #             # Create tables with new schema
            #             await conn.run_sync(Base.metadata.create_all)
            #             logger.info(f"Database tables created for {settings.document_storage_type}")
            #         except Exception as e:
            #             logger.error(f"Error setting up database tables: {str(e)}")
            #             raise
            #     else:
            #         # For SQLite, just create tables if they don't exist
            #         await conn.run_sync(Base.metadata.create_all)
            #         logger.info(f"Database tables created or verified for {settings.document_storage_type}")
                
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            raise
    
    # Initialize repositories with session factory if available
    repository_factory.init_repositories(
        document_type=settings.document_storage_type,
        storage_type=settings.file_storage_type,
        storage_dir=settings.storage_dir,
        db_path=settings.db_path,
        db_host=settings.db_host,
        db_port=settings.db_port,
        db_user=settings.db_user,
        db_password=settings.db_password,
        db_name=settings.db_name,
        aws_access_key=settings.aws_access_key,
        aws_secret_key=settings.aws_secret_key,
        s3_bucket=settings.s3_bucket,
        session_factory=db_session_factory
    )

async def get_db() -> Optional[AsyncSession]:
    """Get database session if needed"""
    if db_session_factory is None:
        yield None
        return
        
    session = db_session_factory()
    try:
        yield session
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise e
    finally:
        await session.close()

def get_document_repository() -> DocumentRepository:
    """Dependency for document repository"""
    return repository_factory.document_repository

def get_storage_repository() -> StorageRepository:
    """Dependency for storage repository"""
    return repository_factory.storage_repository

def get_conversation_repository() -> ConversationRepository:
    """Dependency for conversation repository"""
    return repository_factory.conversation_repository

def get_marker_service() -> MarkerService:
    """Dependency for marker service"""
    settings = get_settings()
    return MarkerService(api_key=settings.datalab_api_key)

def get_llm_service() -> LLMService:
    """Dependency for LLM service"""
    settings = get_settings()
    return LLMService(
        api_key=settings.openai_api_key,
        gemini_api_key=settings.gemini_api_key
    )

def get_critical_content_service() -> CriticalContentService:
    llm_service = get_llm_service()
    return CriticalContentService(llm_service)

def get_upload_service(
    document_repository: DocumentRepository = Depends(get_document_repository),
    storage_repository: StorageRepository = Depends(get_storage_repository),
    marker_service: MarkerService = Depends(get_marker_service),
    critical_content_service: CriticalContentService = Depends(get_critical_content_service),
) -> UploadService:
    """Dependency for upload service that composes other dependencies"""
    return UploadService(
        document_repo=document_repository,
        storage_repo=storage_repository,
        marker=marker_service,
        critical_content_service=critical_content_service,
    )

def get_chat_service(
    conversation_repository: ConversationRepository = Depends(get_conversation_repository),
    document_repository: DocumentRepository = Depends(get_document_repository),
    llm_service: LLMService = Depends(get_llm_service)
) -> ChatService:
    """Dependency for chat service"""
    return ChatService(
        conversation_repository=conversation_repository,
        document_repository=document_repository,
        llm_service=llm_service,
        db_session_factory=db_session_factory
    )
