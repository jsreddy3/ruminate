from typing import List, Optional
from sqlalchemy import select, insert, update, Boolean, Integer, ARRAY, Float
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Column, String, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB

# Import Pydantic models
from src.models.base.document import Document
from src.models.viewer.page import Page
from src.models.viewer.block import Block
from src.models.base.chunk import Chunk

# Import SQLAlchemy models from their new locations
from src.models.base.document import DocumentModel
from src.models.viewer.page import PageModel
from src.models.viewer.block import BlockModel 
from src.models.base.chunk import ChunkModel

from src.repositories.interfaces.document_repository import DocumentRepository
from src.database.base import Base

class RDSDocumentRepository(DocumentRepository):
    """PostgreSQL implementation of DocumentRepository using SQLAlchemy."""
    
    def __init__(self, session_factory):
        """Initialize RDS document repository.
        
        Args:
            session_factory: SQLAlchemy session factory for database operations
        """
        self.session_factory = session_factory
        
    async def store_document(self, document: Document, session: Optional[AsyncSession] = None) -> None:
        """Store a document in the database"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Convert document to dict for insertion
            doc_dict = document.dict()
            
            # Rename metadata to meta_data for SQLAlchemy
            if 'metadata' in doc_dict:
                doc_dict['meta_data'] = doc_dict.pop('metadata')
            
            # Check if document already exists
            result = await session.execute(
                select(DocumentModel).where(DocumentModel.id == document.id)
            )
            existing = result.scalars().first()
            
            if existing:
                # Update existing document
                stmt = update(DocumentModel).where(DocumentModel.id == document.id).values(**doc_dict)
                await session.execute(stmt)
            else:
                # Insert new document
                stmt = insert(DocumentModel).values(**doc_dict)
                await session.execute(stmt)
                
            if local_session:
                await session.commit()
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
        
    async def get_document(self, document_id: str, session: Optional[AsyncSession] = None) -> Optional[Document]:
        """Get a document by ID"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for document
            result = await session.execute(
                select(DocumentModel).where(DocumentModel.id == document_id)
            )
            doc_model = result.scalars().first()
            
            if not doc_model:
                return None
                
            # Convert model to document
            doc_dict = {c.name: getattr(doc_model, c.name) for c in doc_model.__table__.columns}
            
            # Rename meta_data back to metadata for Pydantic
            if 'meta_data' in doc_dict:
                doc_dict['metadata'] = doc_dict.pop('meta_data')
                
            return Document.parse_obj(doc_dict)
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def store_pages(self, pages: List[Page], session: Optional[AsyncSession] = None) -> None:
        """Store pages in the database"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            for page in pages:
                # Convert page to dict for insertion
                page_dict = page.dict()
                
                # Rename metadata to meta_data for SQLAlchemy
                if 'metadata' in page_dict:
                    page_dict['meta_data'] = page_dict.pop('metadata')
                
                # Check if page already exists
                result = await session.execute(
                    select(PageModel).where(PageModel.id == page.id)
                )
                existing = result.scalars().first()
                
                if existing:
                    # Update existing page
                    stmt = update(PageModel).where(PageModel.id == page.id).values(**page_dict)
                    await session.execute(stmt)
                else:
                    # Insert new page
                    stmt = insert(PageModel).values(**page_dict)
                    await session.execute(stmt)
                    
            if local_session:
                await session.commit()
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_document_pages(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Page]:
        """Get all pages for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for pages
            result = await session.execute(
                select(PageModel).where(PageModel.document_id == document_id)
            )
            page_models = result.scalars().all()
            
            # Convert models to pages
            pages = []
            for page_model in page_models:
                page_dict = {c.name: getattr(page_model, c.name) for c in page_model.__table__.columns}
                
                # Rename meta_data back to metadata for Pydantic
                if 'meta_data' in page_dict:
                    page_dict['metadata'] = page_dict.pop('meta_data')
                    
                pages.append(Page.parse_obj(page_dict))
                
            return pages
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
                
    async def get_page_by_number(self, document_id: str, page_number: int, session: Optional[AsyncSession] = None) -> Optional[Page]:
        """Get a page by its number in a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for page with specific page number
            result = await session.execute(
                select(PageModel).where(
                    PageModel.document_id == document_id,
                    PageModel.page_number == page_number
                ).limit(1)
            )
            page_model = result.scalars().first()
            
            if not page_model:
                return None
                
            # Convert model to page
            page_dict = {c.name: getattr(page_model, c.name) for c in page_model.__table__.columns}
            
            # Rename meta_data back to metadata for Pydantic
            if 'meta_data' in page_dict:
                page_dict['metadata'] = page_dict.pop('meta_data')
                
            return Page.parse_obj(page_dict)
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def store_blocks(self, blocks: List[Block], session: Optional[AsyncSession] = None) -> None:
        """Store blocks in the database"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            for block in blocks:
                # Convert block to dict for insertion
                block_dict = block.dict()
                
                # Rename metadata to meta_data for SQLAlchemy
                if 'metadata' in block_dict:
                    block_dict['meta_data'] = block_dict.pop('metadata')
                
                # Check if block already exists
                result = await session.execute(
                    select(BlockModel).where(BlockModel.id == block.id)
                )
                existing = result.scalars().first()
                
                if existing:
                    # Update existing block
                    stmt = update(BlockModel).where(BlockModel.id == block.id).values(**block_dict)
                    await session.execute(stmt)
                else:
                    # Insert new block
                    stmt = insert(BlockModel).values(**block_dict)
                    await session.execute(stmt)
                    
            if local_session:
                await session.commit()
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_page_blocks(self, page_id: str, session: Optional[AsyncSession] = None) -> List[Block]:
        """Get all blocks for a page"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for blocks
            result = await session.execute(
                select(BlockModel).where(BlockModel.page_id == page_id)
            )
            block_models = result.scalars().all()
            
            # Convert models to blocks
            blocks = []
            for block_model in block_models:
                block_dict = {c.name: getattr(block_model, c.name) for c in block_model.__table__.columns}
                
                # Rename meta_data back to metadata for Pydantic
                if 'meta_data' in block_dict:
                    block_dict['metadata'] = block_dict.pop('meta_data')
                    
                blocks.append(Block.parse_obj(block_dict))
                
            return blocks
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()

    async def get_blocks(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Block]:
        """Get all blocks for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for blocks
            result = await session.execute(
                select(BlockModel).where(BlockModel.document_id == document_id)
            )
            block_models = result.scalars().all()
            
            # Convert models to blocks
            blocks = []
            for block_model in block_models:
                block_dict = {c.name: getattr(block_model, c.name) for c in block_model.__table__.columns}
                
                # Rename meta_data back to metadata for Pydantic
                if 'meta_data' in block_dict:
                    block_dict['metadata'] = block_dict.pop('meta_data')
                    
                blocks.append(Block.parse_obj(block_dict))
                
            return blocks
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_block(self, block_id: str, session: Optional[AsyncSession] = None) -> Optional[Block]:
        """Get a block by ID"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for block
            result = await session.execute(
                select(BlockModel).where(BlockModel.id == block_id)
            )
            block_model = result.scalars().first()
            
            if not block_model:
                return None
                
            # Convert model to block
            block_dict = {c.name: getattr(block_model, c.name) for c in block_model.__table__.columns}
            
            # Rename meta_data back to metadata for Pydantic
            if 'meta_data' in block_dict:
                block_dict['metadata'] = block_dict.pop('meta_data')
                
            return Block.parse_obj(block_dict)
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()

    async def store_chunks(self, chunks: List[Chunk], session: Optional[AsyncSession] = None) -> None:
        """Store document chunks in the database"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            for chunk in chunks:
                # Convert chunk to dict for insertion
                chunk_dict = chunk.dict()
                
                # Rename metadata to meta_data for SQLAlchemy
                if 'metadata' in chunk_dict:
                    chunk_dict['meta_data'] = chunk_dict.pop('metadata')
                
                # Check if chunk already exists
                result = await session.execute(
                    select(ChunkModel).where(ChunkModel.id == chunk.id)
                )
                existing = result.scalars().first()
                
                if existing:
                    # Update existing chunk
                    stmt = update(ChunkModel).where(ChunkModel.id == chunk.id).values(**chunk_dict)
                    await session.execute(stmt)
                else:
                    # Insert new chunk
                    stmt = insert(ChunkModel).values(**chunk_dict)
                    await session.execute(stmt)
                    
            if local_session:
                await session.commit()
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
                
    async def get_chunks(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Chunk]:
        """Get all chunks for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for chunks
            result = await session.execute(
                select(ChunkModel).where(ChunkModel.document_id == document_id)
            )
            chunk_models = result.scalars().all()
            
            # Convert models to chunks
            chunks = []
            for chunk_model in chunk_models:
                chunk_dict = {c.name: getattr(chunk_model, c.name) for c in chunk_model.__table__.columns}
                
                # Rename meta_data back to metadata for Pydantic
                if 'meta_data' in chunk_dict:
                    chunk_dict['metadata'] = chunk_dict.pop('meta_data')
                    
                chunks.append(Chunk.parse_obj(chunk_dict))
                
            return chunks
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
                
    async def get_chunk(self, chunk_id: str, session: Optional[AsyncSession] = None) -> Optional[Chunk]:
        """Get a specific chunk by ID"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for chunk
            result = await session.execute(
                select(ChunkModel).where(ChunkModel.id == chunk_id)
            )
            chunk_model = result.scalars().first()
            
            if not chunk_model:
                return None
                
            # Convert model to chunk
            chunk_dict = {c.name: getattr(chunk_model, c.name) for c in chunk_model.__table__.columns}
            
            # Rename meta_data back to metadata for Pydantic
            if 'meta_data' in chunk_dict:
                chunk_dict['metadata'] = chunk_dict.pop('meta_data')
                
            return Chunk.parse_obj(chunk_dict)
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
                
    async def update_document_arguments(self, document_id: str, arguments: List[dict], session: Optional[AsyncSession] = None) -> None:
        """Update the arguments for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Update document arguments
            stmt = update(DocumentModel).where(DocumentModel.id == document_id).values(arguments=arguments)
            await session.execute(stmt)
                
            if local_session:
                await session.commit()
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
                
    async def update_document_key_themes_terms(self, document_id: str, key_themes_terms: List[dict], session: Optional[AsyncSession] = None) -> None:
        """Update the key themes and terms for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Update document key themes and terms
            stmt = update(DocumentModel).where(DocumentModel.id == document_id).values(key_themes_terms=key_themes_terms)
            await session.execute(stmt)
                
            if local_session:
                await session.commit()
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
