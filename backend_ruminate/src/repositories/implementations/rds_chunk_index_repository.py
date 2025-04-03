from typing import List, Optional, Dict, Any
import json
import logging
from datetime import datetime
from sqlalchemy import select, insert, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from src.models.rumination.chunk_index import ChunkIndex, ChunkIndexModel
from src.repositories.interfaces.chunk_index_repository import ChunkIndexRepository

logger = logging.getLogger(__name__)

class RDSChunkIndexRepository(ChunkIndexRepository):
    """PostgreSQL implementation of ChunkIndex repository using SQLAlchemy."""
    
    def __init__(self, session_factory):
        """Initialize RDS chunk index repository.
        
        Args:
            session_factory: SQLAlchemy session factory for database operations
        """
        self.session_factory = session_factory
        
    async def create_chunk_index(self, chunk_index: ChunkIndex) -> ChunkIndex:
        """Create a new chunk index"""
        local_session = False
        session = None
        
        try:
            session = self.session_factory()
            local_session = True
            
            # Check if a chunk index already exists for this chunk
            existing = await self.get_chunk_index(chunk_index.chunk_id, session)
            if existing:
                return await self.update_chunk_index(chunk_index, session)
            
            # Convert datetime objects to ISO format strings
            created_at = chunk_index.created_at.isoformat() if chunk_index.created_at else datetime.now().isoformat()
            updated_at = chunk_index.updated_at.isoformat() if chunk_index.updated_at else datetime.now().isoformat()
            
            # Create SQLAlchemy model instance
            db_chunk_index = ChunkIndexModel(
                id=chunk_index.id,
                chunk_id=chunk_index.chunk_id,
                document_id=chunk_index.document_id,
                sequence=chunk_index.sequence,
                summary=chunk_index.summary,
                authority_references=chunk_index.authority_references,
                contested_definitions=chunk_index.contested_definitions,
                argumentative_moves=chunk_index.argumentative_moves,
                counter_responses=chunk_index.counter_responses,
                core_principles=chunk_index.core_principles,
                identity_claims=chunk_index.identity_claims,
                institutional_functions=chunk_index.institutional_functions,
                created_at=created_at,
                updated_at=updated_at
            )
            
            # Add to session and commit
            session.add(db_chunk_index)
            await session.commit()
            
            return chunk_index
        except IntegrityError:
            if session:
                await session.rollback()
            # If we hit an integrity error, try updating instead
            return await self.update_chunk_index(chunk_index)
        except Exception as e:
            if session and local_session:
                await session.rollback()
            logger.error(f"Error creating chunk index: {str(e)}")
            raise
        finally:
            if session and local_session:
                await session.close()
    
    async def get_chunk_index(self, chunk_id: str, session: Optional[AsyncSession] = None) -> Optional[ChunkIndex]:
        """Get a chunk index by chunk ID"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for chunk index
            result = await session.execute(
                select(ChunkIndexModel).where(ChunkIndexModel.chunk_id == chunk_id)
            )
            model = result.scalars().first()
            
            if not model:
                return None
                
            # Convert to Pydantic model
            # Parse datetime strings if needed
            created_at = datetime.fromisoformat(model.created_at) if isinstance(model.created_at, str) else model.created_at
            updated_at = datetime.fromisoformat(model.updated_at) if isinstance(model.updated_at, str) else model.updated_at
            
            return ChunkIndex(
                id=model.id,
                chunk_id=model.chunk_id,
                document_id=model.document_id,
                sequence=model.sequence,
                summary=model.summary,
                authority_references=model.authority_references,
                contested_definitions=model.contested_definitions,
                argumentative_moves=model.argumentative_moves,
                counter_responses=model.counter_responses,
                core_principles=model.core_principles,
                identity_claims=model.identity_claims,
                institutional_functions=model.institutional_functions,
                created_at=created_at,
                updated_at=updated_at
            )
        except Exception as e:
            logger.error(f"Error getting chunk index: {str(e)}")
            raise
        finally:
            if local_session:
                await session.close()
    
    async def get_document_chunk_indices(self, document_id: str, session: Optional[AsyncSession] = None) -> List[ChunkIndex]:
        """Get all chunk indices for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for chunk indices
            result = await session.execute(
                select(ChunkIndexModel).where(ChunkIndexModel.document_id == document_id)
            )
            models = result.scalars().all()
            
            # Convert to Pydantic models
            indices = []
            for model in models:
                # Parse datetime strings if needed
                created_at = datetime.fromisoformat(model.created_at) if isinstance(model.created_at, str) else model.created_at
                updated_at = datetime.fromisoformat(model.updated_at) if isinstance(model.updated_at, str) else model.updated_at
                
                indices.append(ChunkIndex(
                    id=model.id,
                    chunk_id=model.chunk_id,
                    document_id=model.document_id,
                    sequence=model.sequence,
                    summary=model.summary,
                    authority_references=model.authority_references,
                    contested_definitions=model.contested_definitions,
                    argumentative_moves=model.argumentative_moves,
                    counter_responses=model.counter_responses,
                    core_principles=model.core_principles,
                    identity_claims=model.identity_claims,
                    institutional_functions=model.institutional_functions,
                    created_at=created_at,
                    updated_at=updated_at
                ))
            
            return indices
        except Exception as e:
            logger.error(f"Error getting document chunk indices: {str(e)}")
            raise
        finally:
            if local_session:
                await session.close()
    
    async def update_chunk_index(self, chunk_index: ChunkIndex, session: Optional[AsyncSession] = None) -> ChunkIndex:
        """Update a chunk index"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Check if chunk index exists
            result = await session.execute(
                select(ChunkIndexModel).where(ChunkIndexModel.chunk_id == chunk_index.chunk_id)
            )
            model = result.scalars().first()
            
            # If it doesn't exist, create it
            if not model:
                if local_session:
                    await session.close()
                return await self.create_chunk_index(chunk_index)
            
            # Update timestamps
            chunk_index.updated_at = datetime.now()
            updated_at = chunk_index.updated_at.isoformat()
            
            # Update model attributes
            model.id = chunk_index.id
            model.document_id = chunk_index.document_id
            model.sequence = chunk_index.sequence
            model.summary = chunk_index.summary
            model.authority_references = chunk_index.authority_references
            model.contested_definitions = chunk_index.contested_definitions
            model.argumentative_moves = chunk_index.argumentative_moves
            model.counter_responses = chunk_index.counter_responses
            model.core_principles = chunk_index.core_principles
            model.identity_claims = chunk_index.identity_claims
            model.institutional_functions = chunk_index.institutional_functions
            model.updated_at = updated_at
            
            await session.commit()
            
            return chunk_index
        except Exception as e:
            if session:
                await session.rollback()
            logger.error(f"Error updating chunk index: {str(e)}")
            raise
        finally:
            if local_session:
                await session.close()
    
    async def delete_chunk_index(self, chunk_id: str, session: Optional[AsyncSession] = None) -> None:
        """Delete a chunk index"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Find the chunk index
            result = await session.execute(
                select(ChunkIndexModel).where(ChunkIndexModel.chunk_id == chunk_id)
            )
            model = result.scalars().first()
            
            # If it exists, delete it
            if model:
                await session.delete(model)
                await session.commit()
        except Exception as e:
            if session:
                await session.rollback()
            logger.error(f"Error deleting chunk index: {str(e)}")
            raise
        finally:
            if local_session:
                await session.close()
