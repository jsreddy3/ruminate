# repositories/factory.py
from enum import Enum
from typing import Optional
from .interfaces.document_repository import DocumentRepository
from .interfaces.storage_repository import StorageRepository
from .interfaces.conversation_repository import ConversationRepository
from .interfaces.insight_repository import InsightRepository
from .interfaces.chunk_index_repository import ChunkIndexRepository
from .interfaces.key_term_repository import KeyTermRepository

class StorageType(Enum):
    SQLITE = "sqlite"
    S3 = "s3"
    RDS = "rds"
    LOCAL = "local" # Kept for file storage

class RepositoryFactory:
    def __init__(self):
        self._document_repo: Optional[DocumentRepository] = None
        self._storage_repo: Optional[StorageRepository] = None
        self._conversation_repo: Optional[ConversationRepository] = None
        self._insight_repo: Optional[InsightRepository] = None
        self._chunk_index_repo: Optional[ChunkIndexRepository] = None
        self._key_term_repo: Optional[KeyTermRepository] = None
        
    def init_repositories(
        self,
        document_type: str = "sqlite",
        storage_type: str = "local",
        **kwargs  # For connection strings, credentials etc
    ):
        """Initialize repositories based on type.
        """
        if document_type == "sqlite":
            from .implementations.sqlite_document_repository import SQLiteDocumentRepository
            from .implementations.sqlite_conversation_repository import SQLiteConversationRepository
            from .implementations.sqlite_insight_repository import SQLiteInsightRepository
            from .implementations.sqlite_chunk_index_repository import SQLiteChunkIndexRepository
            from .implementations.sqlite_key_term_repository import SQLiteKeyTermRepository
            db_path = kwargs.get('db_path', 'sqlite.db')
            
            # Create session factory if not exists
            if 'session_factory' not in kwargs:
                from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
                from sqlalchemy.orm import sessionmaker
                engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
                kwargs['session_factory'] = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            
            self._document_repo = SQLiteDocumentRepository(db_path=db_path)
            self._conversation_repo = SQLiteConversationRepository(db_path=db_path)
            self._insight_repo = SQLiteInsightRepository(kwargs['session_factory'])
            self._chunk_index_repo = SQLiteChunkIndexRepository(
                session_factory=kwargs['session_factory'],
                db_path=db_path
            )
            self._key_term_repo = SQLiteKeyTermRepository(db_path=db_path)
            
        elif document_type == "rds":
            # Import both RDS and SQLite implementations
            from .implementations.rds_document_repository import RDSDocumentRepository
            from .implementations.rds_conversation_repository import RDSConversationRepository
            from .implementations.rds_insight_repository import RDSInsightRepository
            from .implementations.sqlite_chunk_index_repository import SQLiteChunkIndexRepository
            from .implementations.sqlite_key_term_repository import SQLiteKeyTermRepository
            
            # Create session factory for PostgreSQL if not exists
            if 'session_factory' not in kwargs:
                from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
                from sqlalchemy.orm import sessionmaker
                url = f"postgresql+asyncpg://{kwargs.get('db_user')}:{kwargs.get('db_password')}@{kwargs.get('db_host')}:{kwargs.get('db_port')}/{kwargs.get('db_name', 'ruminate_document_table')}"
                engine = create_async_engine(url, echo=False)  # Reduced logging verbosity
                kwargs['session_factory'] = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            
            # Use RDS for document, conversation, and insight repositories
            self._document_repo = RDSDocumentRepository(kwargs['session_factory'])
            self._conversation_repo = RDSConversationRepository(kwargs['session_factory'])
            self._insight_repo = RDSInsightRepository(kwargs['session_factory'])
            
            # Use SQLite for other repositories (hybrid approach for testing)
            db_path = kwargs.get('db_path', 'sqlite.db')
            self._chunk_index_repo = SQLiteChunkIndexRepository(
                session_factory=kwargs['session_factory'],
                db_path=db_path
            )
            self._key_term_repo = SQLiteKeyTermRepository(db_path=db_path)

        if storage_type == "local":
            from .implementations.local_storage_repository import LocalStorageRepository
            self._storage_repo = LocalStorageRepository(storage_dir=kwargs.get('storage_dir', 'local_storage'))
        elif storage_type == "s3":
            from .implementations.s3_storage_repository import S3StorageRepository
            self._storage_repo = S3StorageRepository(
                bucket_name=kwargs.get('s3_bucket'),
                aws_access_key=kwargs.get('aws_access_key'),
                aws_secret_key=kwargs.get('aws_secret_key')
            )

    @property
    def document_repository(self) -> DocumentRepository:
        if not self._document_repo:
            raise RuntimeError("Repository not initialized. Call init_repositories first.")
        return self._document_repo

    @property
    def storage_repository(self) -> StorageRepository:
        if not self._storage_repo:
            raise RuntimeError("Repository not initialized. Call init_repositories first.")
        return self._storage_repo

    @property
    def conversation_repository(self) -> ConversationRepository:
        """Get conversation repository instance"""
        if not self._conversation_repo:
            raise RuntimeError("Conversation repository not initialized")
        return self._conversation_repo

    @property
    def insight_repository(self) -> InsightRepository:
        """Get insight repository instance"""
        if not self._insight_repo:
            raise RuntimeError("Insight repository not initialized")
        return self._insight_repo
        
    @property
    def chunk_index_repository(self) -> ChunkIndexRepository:
        """Get chunk index repository instance"""
        if not self._chunk_index_repo:
            raise RuntimeError("Chunk index repository not initialized")
        return self._chunk_index_repo
        
    @property
    def key_term_repository(self) -> KeyTermRepository:
        """Get key term repository instance"""
        if not self._key_term_repo:
            raise RuntimeError("Key term repository not initialized")
        return self._key_term_repo