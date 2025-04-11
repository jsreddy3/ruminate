from typing import List, Optional, Dict, Any
import aiosqlite
import sqlite3
import json
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from src.models.base.document import Document
from src.models.viewer.page import Page
from src.models.viewer.block import Block
from src.models.base.chunk import Chunk
from src.repositories.interfaces.document_repository import DocumentRepository

class SQLiteDocumentRepository(DocumentRepository):
    """SQLite implementation of DocumentRepository."""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._ensure_db()
    
    def _ensure_db(self):
        """Create database and tables if they don't exist."""
        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
            
        with sqlite3.connect(self.db_path) as db:
            # Create documents table
            db.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
            """)
            
            # Create pages table
            db.execute("""
                CREATE TABLE IF NOT EXISTS pages (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    data TEXT NOT NULL,
                    FOREIGN KEY (document_id) REFERENCES documents(id)
                )
            """)
            
            # Create blocks table
            db.execute("""
                CREATE TABLE IF NOT EXISTS blocks (
                    id TEXT PRIMARY KEY,
                    page_id TEXT NOT NULL,
                    chunk_id TEXT,
                    data TEXT NOT NULL,
                    FOREIGN KEY (page_id) REFERENCES pages(id),
                    FOREIGN KEY (chunk_id) REFERENCES chunks(id)
                )
            """)
            
            # Create chunks table
            db.execute("""
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    data TEXT NOT NULL,
                    FOREIGN KEY (document_id) REFERENCES documents(id)
                )
            """)
            db.commit()
    
    async def store_document(self, document: Document, session: Optional[AsyncSession] = None) -> None:
        """Store a document in SQLite."""
        if session:
            await session.execute(
                text("INSERT OR REPLACE INTO documents (id, data) VALUES (:id, :data)"),
                {
                    "id": document.id,
                    "data": document.json()
                }
            )
            return
            
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO documents (id, data) VALUES (?, ?)",
                (document.id, document.json())
            )
            await db.commit()
    
    async def get_document(self, document_id: str, session: Optional[AsyncSession] = None) -> Optional[Document]:
        """Get a document by ID from SQLite."""
        if session:
            result = await session.execute(
                text("SELECT data FROM documents WHERE id = :id"),
                {"id": document_id}
            )
            row = result.fetchone()
            if row:
                return Document.parse_raw(row[0])
            return None
            
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM documents WHERE id = ?",
                (document_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return Document.parse_raw(row[0])
        return None
    
    async def store_pages(self, pages: List[Page], session: Optional[AsyncSession] = None) -> None:
        """Store pages in SQLite."""
        if session:
            for page in pages:
                await session.execute(
                    text("INSERT OR REPLACE INTO pages (id, document_id, data) VALUES (:id, :document_id, :data)"),
                    {
                        "id": page.id,
                        "document_id": page.document_id,
                        "data": page.json()
                    }
                )
            return
            
        async with aiosqlite.connect(self.db_path) as db:
            for page in pages:
                await db.execute(
                    "INSERT OR REPLACE INTO pages (id, document_id, data) VALUES (?, ?, ?)",
                    (page.id, page.document_id, page.json())
                )
            await db.commit()
    
    async def get_document_pages(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Page]:
        """Get all pages for a document from SQLite."""
        if session:
            result = await session.execute(
                text("SELECT data FROM pages WHERE document_id = :document_id"),
                {"document_id": document_id}
            )
            return [Page.parse_raw(row[0]) for row in result]
            
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM pages WHERE document_id = ?",
                (document_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [Page.parse_raw(row[0]) for row in rows]
    
    async def store_blocks(self, blocks: List[Block], session: Optional[AsyncSession] = None) -> None:
        """Store blocks in SQLite."""
        if session:
            for block in blocks:
                await session.execute(
                    text("INSERT OR REPLACE INTO blocks (id, page_id, data) VALUES (:id, :page_id, :data)"),
                    {
                        "id": block.id,
                        "page_id": block.page_id,
                        "data": block.json()
                    }
                )
            return
            
        async with aiosqlite.connect(self.db_path) as db:
            for block in blocks:
                await db.execute(
                    "INSERT OR REPLACE INTO blocks (id, page_id, data) VALUES (?, ?, ?)",
                    (block.id, block.page_id, block.json())
                )
            await db.commit()
    
    async def get_page_blocks(self, page_id: str, session: Optional[AsyncSession] = None) -> List[Block]:
        """Get all blocks for a page from SQLite."""
        if session:
            result = await session.execute(
                text("SELECT data FROM blocks WHERE page_id = :page_id"),
                {"page_id": page_id}
            )
            return [Block.parse_raw(row[0]) for row in result]
            
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM blocks WHERE page_id = ?",
                (page_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [Block.parse_raw(row[0]) for row in rows]
    
    async def get_pages(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Page]:
        """Get all pages for a document"""
        if session:
            result = await session.execute(
                text("SELECT data FROM pages WHERE document_id = :document_id"),
                {"document_id": document_id}
            )
            return [Page.parse_raw(row[0]) for row in result]
            
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM pages WHERE document_id = ?",
                (document_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [Page.parse_raw(row[0]) for row in rows]
    
    async def get_page_by_number(self, document_id: str, page_number: int, session: Optional[AsyncSession] = None) -> Optional[Page]:
        """Get a page by its number in a document"""
        if session:
            result = await session.execute(
                text("SELECT data FROM pages WHERE document_id = :doc_id AND json_extract(data, '$.page_number') = :page_num LIMIT 1"),
                {"doc_id": document_id, "page_num": page_number}
            )
            row = result.fetchone()
            if row:
                return Page.parse_raw(row[0])
            return None
        
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM pages WHERE document_id = ? AND json_extract(data, '$.page_number') = ? LIMIT 1",
                (document_id, page_number)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return Page.parse_raw(row[0])
            return None
    
    async def get_blocks(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Block]:
        """Get all blocks for a document"""
        if session:
            result = await session.execute(
                text("""
                    SELECT b.data, p.data as page_data
                    FROM blocks b 
                    JOIN pages p ON b.page_id = p.id 
                    WHERE p.document_id = :document_id
                """),
                {"document_id": document_id}
            )
            blocks = []
            for row in result:
                block = Block.parse_raw(row[0])
                page = Page.parse_raw(row[1])
                block.page_number = page.page_number
                blocks.append(block)
            return blocks
            
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                """
                SELECT b.data, p.data as page_data
                FROM blocks b 
                JOIN pages p ON b.page_id = p.id 
                WHERE p.document_id = ?
                """,
                (document_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                blocks = []
                for row in rows:
                    block = Block.parse_raw(row[0])
                    page = Page.parse_raw(row[1])
                    block.page_number = page.page_number
                    blocks.append(block)
                return blocks
    
    async def get_block(self, block_id: str, session: Optional[AsyncSession] = None) -> Optional[Block]:
        """Get a block by ID from SQLite"""
        if session:
            result = await session.execute(
                text("SELECT data FROM blocks WHERE id = :id"),
                {"id": block_id}
            )
            row = result.fetchone()
            if row:
                return Block.parse_raw(row[0])
            return None
            
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM blocks WHERE id = ?",
                (block_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return Block.parse_raw(row[0])
        return None

    async def store_chunks(self, chunks: List[Chunk], session: Optional[AsyncSession] = None) -> None:
        """Store a list of chunks in the database.
        
        Args:
            chunks: List of Chunk objects to store
            session: Optional database session
        """
        if not chunks:
            return
            
        # If using a session
        if session:
            for chunk in chunks:
                await session.execute(
                    text("INSERT OR REPLACE INTO chunks (id, document_id, data) VALUES (:id, :document_id, :data)"),
                    {
                        "id": chunk.id,
                        "document_id": chunk.document_id,
                        "data": chunk.json()
                    }
                )
                
                # Update block references
                if chunk.block_ids:
                    for block_id in chunk.block_ids:
                        await session.execute(
                            text("UPDATE blocks SET chunk_id = :chunk_id WHERE id = :block_id"),
                            {"chunk_id": chunk.id, "block_id": block_id}
                        )
            return
        
        # If not using a session
        async with aiosqlite.connect(self.db_path) as db:
            for chunk in chunks:
                await db.execute(
                    "INSERT OR REPLACE INTO chunks (id, document_id, data) VALUES (?, ?, ?)",
                    (chunk.id, chunk.document_id, chunk.json())
                )
                
                # Update block references
                if chunk.block_ids:
                    for block_id in chunk.block_ids:
                        await db.execute(
                            "UPDATE blocks SET chunk_id = ? WHERE id = ?",
                            (chunk.id, block_id)
                        )
            await db.commit()
            
        logger.info(f"Stored {len(chunks)} chunks for document {chunks[0].document_id}")
    
    async def get_chunks(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Chunk]:
        """Get all chunks for a document.
        
        Args:
            document_id: ID of the document
            session: Optional database session
            
        Returns:
            List of Chunk objects
        """
        # If using a session
        if session:
            result = await session.execute(
                text("SELECT data FROM chunks WHERE document_id = :document_id ORDER BY id"),
                {"document_id": document_id}
            )
            return [Chunk.parse_raw(row[0]) for row in result]
        
        # If not using a session
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM chunks WHERE document_id = ? ORDER BY id",
                (document_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [Chunk.parse_raw(row[0]) for row in rows]
    
    async def get_chunk(self, chunk_id: str, session: Optional[AsyncSession] = None) -> Optional[Chunk]:
        """Get a chunk by ID.
        
        Args:
            chunk_id: ID of the chunk
            session: Optional database session
            
        Returns:
            Chunk object if found, None otherwise
        """
        # If using a session
        if session:
            result = await session.execute(
                text("SELECT data FROM chunks WHERE id = :id"),
                {"id": chunk_id}
            )
            row = result.fetchone()
            if row:
                return Chunk.parse_raw(row[0])
            return None
        
        # If not using a session
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT data FROM chunks WHERE id = ?",
                (chunk_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return Chunk.parse_raw(row[0])
        return None
        
    async def update_document_arguments(self, document_id: str, arguments: List[dict], session: Optional[AsyncSession] = None) -> None:
        """Update the arguments for a document by completely overwriting any existing arguments
        
        Args:
            document_id: ID of the document to update
            arguments: List of argument dictionaries to save (will replace ALL existing arguments)
            session: Optional database session
        """
        # First get the document
        document = await self.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document with ID {document_id} not found")
            
        # Process arguments to ensure a consistent format
        processed_arguments = []
        for i, arg in enumerate(arguments):
            # Make a copy of the argument to avoid modifying the original
            arg_copy = dict(arg)
            
            # Add ID if not present
            if 'id' not in arg_copy:
                # Create a slug ID from the name by replacing spaces with underscores and removing special chars
                name_slug = arg_copy.get('name', f"argument_{i}")
                slug_id = ''.join(c if c.isalnum() else '_' for c in name_slug.lower())
                arg_copy['id'] = slug_id
                
            processed_arguments.append(arg_copy)
            
        # Update the document
        document.arguments = processed_arguments
        
        # Save the document back to the database
        await self.store_document(document, session)
        
    async def update_document_key_themes_terms(self, document_id: str, key_themes_terms: List[dict], session: Optional[AsyncSession] = None) -> None:
        """Update the key themes and terms for a document by completely overwriting any existing data
        
        Args:
            document_id: ID of the document to update
            key_themes_terms: List of key theme/term dictionaries to save (will replace ALL existing key themes/terms)
            session: Optional database session
        """
        # First get the document
        document = await self.get_document(document_id, session)
        if not document:
            raise ValueError(f"Document with ID {document_id} not found")
            
        # Process key themes and terms to ensure a consistent format
        processed_key_themes_terms = []
        for i, theme in enumerate(key_themes_terms):
            # Make a copy of the theme to avoid modifying the original
            theme_copy = dict(theme)
            
            # Add ID if not present
            if 'id' not in theme_copy:
                # Create a slug ID from the theme name
                theme_name = theme_copy.get('theme_name', f"theme_{i}")
                slug_id = ''.join(c if c.isalnum() else '_' for c in theme_name.lower())
                theme_copy['id'] = slug_id
                
            processed_key_themes_terms.append(theme_copy)
            
        # Update the document
        document.key_themes_terms = processed_key_themes_terms
        
        # Save the document back to the database
        await self.store_document(document, session)
