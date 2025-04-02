# repositories/implementations/sqlite_chunk_index_repository.py
import json
import os
import sqlite3
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy import update, delete, text

from src.models.rumination.chunk_index import ChunkIndex
from src.repositories.interfaces.chunk_index_repository import ChunkIndexRepository

class SQLiteChunkIndexRepository(ChunkIndexRepository):
    """SQLite implementation of ChunkIndex repository"""
    
    def __init__(self, session_factory=None, db_path: str = "sqlite.db"):
        self.session_factory = session_factory
        self.db_path = db_path
        self._ensure_db()
        
    def _ensure_db(self):
        """Create database and tables if they don't exist."""
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
            
        with sqlite3.connect(self.db_path) as db:
            # Create chunk_indices table
            db.execute("""
                CREATE TABLE IF NOT EXISTS chunk_indices (
                    id TEXT PRIMARY KEY,
                    chunk_id TEXT NOT NULL UNIQUE,
                    document_id TEXT NOT NULL,
                    data TEXT NOT NULL
                )
            """)
            db.commit()
        
    async def create_chunk_index(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Create a new chunk index
        
        Args:
            chunk_index: ChunkIndex instance to create
            
        Returns:
            Created ChunkIndex instance
        """
        if self.session_factory:
            return await self._create_chunk_index_sqlalchemy(chunk_index)
        else:
            return await self._create_chunk_index_sqlite(chunk_index)
    
    async def _create_chunk_index_sqlalchemy(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Create chunk index using SQLAlchemy"""
        async with self.session_factory() as session:
            try:
                # Check if a chunk index already exists for this chunk
                existing = await self._get_chunk_index_sqlalchemy_direct(session, chunk_index.chunk_id)
                if existing:
                    return await self.update_chunk_index(chunk_index)
                
                # Create a data dict for the raw SQLite format
                data_dict = chunk_index.model_dump()
                
                # Insert using SQLAlchemy Core with text() wrapper
                query = text("INSERT INTO chunk_indices (id, chunk_id, document_id, data) VALUES (:id, :chunk_id, :document_id, :data)")
                
                await session.execute(
                    query,
                    {
                        "id": chunk_index.id,
                        "chunk_id": chunk_index.chunk_id,
                        "document_id": chunk_index.document_id,
                        "data": json.dumps(data_dict)
                    }
                )
                await session.commit()
                
                return chunk_index
            except Exception as e:
                await session.rollback()
                raise ValueError(f"Error creating chunk index: {str(e)}")
    
    async def _get_chunk_index_sqlalchemy_direct(self, session, chunk_id: str) -> Optional[ChunkIndex]:
        """Internal method to get a chunk index directly using a session"""
        query = text("SELECT data FROM chunk_indices WHERE chunk_id = :chunk_id")
        result = await session.execute(query, {"chunk_id": chunk_id})
        row = result.fetchone()
        
        if not row:
            return None
            
        # Parse JSON data
        data = json.loads(row[0])
        return ChunkIndex.model_validate(data)
    
    async def _create_chunk_index_sqlite(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Create chunk index using direct SQLite"""
        # Convert chunk index to dict for JSON serialization
        data_dict = chunk_index.model_dump()
        
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            
            # Check if chunk index already exists
            cursor.execute("SELECT id FROM chunk_indices WHERE chunk_id = ?", (chunk_index.chunk_id,))
            if cursor.fetchone():
                conn.close()
                return await self.update_chunk_index(chunk_index)
            
            # Insert chunk index
            cursor.execute(
                "INSERT INTO chunk_indices (id, chunk_id, document_id, data) VALUES (?, ?, ?, ?)",
                (chunk_index.id, chunk_index.chunk_id, chunk_index.document_id, json.dumps(data_dict))
            )
            conn.commit()
            conn.close()
            
            return chunk_index
        except Exception as e:
            conn.rollback()
            conn.close()
            raise ValueError(f"Error creating chunk index: {str(e)}")
                
    async def get_chunk_index(self, chunk_id: str) -> Optional[ChunkIndex]:
        """Get a chunk index by chunk ID
        
        Args:
            chunk_id: ID of the chunk
            
        Returns:
            ChunkIndex instance if found, None otherwise
        """
        if self.session_factory:
            return await self._get_chunk_index_sqlalchemy(chunk_id)
        else:
            return await self._get_chunk_index_sqlite(chunk_id)
            
    async def _get_chunk_index_sqlalchemy(self, chunk_id: str) -> Optional[ChunkIndex]:
        """Get chunk index using SQLAlchemy"""
        async with self.session_factory() as session:
            query = text("SELECT data FROM chunk_indices WHERE chunk_id = :chunk_id")
            result = await session.execute(query, {"chunk_id": chunk_id})
            row = result.fetchone()
            
            if not row:
                return None
                
            # Parse JSON data
            data = json.loads(row[0])
            return ChunkIndex.model_validate(data)
    
    async def _get_chunk_index_sqlite(self, chunk_id: str) -> Optional[ChunkIndex]:
        """Get chunk index using direct SQLite"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT data FROM chunk_indices WHERE chunk_id = ?", (chunk_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
            
        # Parse JSON data
        data = json.loads(row[0])
        return ChunkIndex.model_validate(data)
            
    async def get_document_chunk_indices(self, document_id: str) -> List[ChunkIndex]:
        """Get all chunk indices for a document
        
        Args:
            document_id: ID of the document
            
        Returns:
            List of ChunkIndex instances
        """
        if self.session_factory:
            return await self._get_document_chunk_indices_sqlalchemy(document_id)
        else:
            return await self._get_document_chunk_indices_sqlite(document_id)
            
    async def _get_document_chunk_indices_sqlalchemy(self, document_id: str) -> List[ChunkIndex]:
        """Get document chunk indices using SQLAlchemy"""
        async with self.session_factory() as session:
            query = text("SELECT data FROM chunk_indices WHERE document_id = :document_id")
            result = await session.execute(query, {"document_id": document_id})
            rows = result.fetchall()
            
            chunk_indices = []
            for row in rows:
                data = json.loads(row[0])
                chunk_indices.append(ChunkIndex.model_validate(data))
                
            return chunk_indices
    
    async def _get_document_chunk_indices_sqlite(self, document_id: str) -> List[ChunkIndex]:
        """Get document chunk indices using direct SQLite"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT data FROM chunk_indices WHERE document_id = ?", (document_id,))
        rows = cursor.fetchall()
        conn.close()
        
        chunk_indices = []
        for row in rows:
            data = json.loads(row[0])
            chunk_indices.append(ChunkIndex.model_validate(data))
            
        return chunk_indices
            
    async def update_chunk_index(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Update a chunk index
        
        Args:
            chunk_index: ChunkIndex instance with updated data
            
        Returns:
            Updated ChunkIndex instance
        """
        if self.session_factory:
            return await self._update_chunk_index_sqlalchemy(chunk_index)
        else:
            return await self._update_chunk_index_sqlite(chunk_index)
            
    async def _update_chunk_index_sqlalchemy(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Update chunk index using SQLAlchemy"""
        async with self.session_factory() as session:
            try:
                # Convert to dict for JSON serialization
                data_dict = chunk_index.model_dump()
                
                # Update the chunk index
                query = text("UPDATE chunk_indices SET data = :data WHERE chunk_id = :chunk_id")
                await session.execute(
                    query,
                    {
                        "chunk_id": chunk_index.chunk_id,
                        "data": json.dumps(data_dict)
                    }
                )
                await session.commit()
                
                return chunk_index
            except Exception as e:
                await session.rollback()
                raise ValueError(f"Error updating chunk index: {str(e)}")
    
    async def _update_chunk_index_sqlite(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Update chunk index using direct SQLite"""
        # Convert to dict for JSON serialization
        data_dict = chunk_index.model_dump()
        
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            
            # Update the chunk index
            cursor.execute(
                "UPDATE chunk_indices SET data = ? WHERE chunk_id = ?",
                (json.dumps(data_dict), chunk_index.chunk_id)
            )
            conn.commit()
            conn.close()
            
            return chunk_index
        except Exception as e:
            conn.rollback()
            conn.close()
            raise ValueError(f"Error updating chunk index: {str(e)}")
                
    async def delete_chunk_index(self, chunk_id: str) -> None:
        """Delete a chunk index
        
        Args:
            chunk_id: ID of the chunk
        """
        if self.session_factory:
            await self._delete_chunk_index_sqlalchemy(chunk_id)
        else:
            await self._delete_chunk_index_sqlite(chunk_id)
            
    async def _delete_chunk_index_sqlalchemy(self, chunk_id: str) -> None:
        """Delete chunk index using SQLAlchemy"""
        async with self.session_factory() as session:
            try:
                query = text("DELETE FROM chunk_indices WHERE chunk_id = :chunk_id")
                await session.execute(query, {"chunk_id": chunk_id})
                await session.commit()
            except Exception as e:
                await session.rollback()
                raise ValueError(f"Error deleting chunk index: {str(e)}")
    
    async def _delete_chunk_index_sqlite(self, chunk_id: str) -> None:
        """Delete chunk index using direct SQLite"""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM chunk_indices WHERE chunk_id = ?", (chunk_id,))
            conn.commit()
            conn.close()
        except Exception as e:
            conn.rollback()
            conn.close()
            raise ValueError(f"Error deleting chunk index: {str(e)}") 