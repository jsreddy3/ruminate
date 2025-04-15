from typing import List, Optional, Dict, Any
import logging
from datetime import datetime
from sqlalchemy import select, insert, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.notes.notes import Notes, NotesModel
from src.repositories.interfaces.notes_repository import NotesRepository

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class RDSNotesRepository(NotesRepository):
    """PostgreSQL implementation of NotesRepository using SQLAlchemy."""
    
    def __init__(self, session_factory):
        """Initialize RDS notes repository.
        
        Args:
            session_factory: SQLAlchemy session factory for database operations
        """
        self.session_factory = session_factory
        
    async def create_note(self, note: Notes, session: Optional[AsyncSession] = None) -> Notes:
        """Create a new note"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Convert note to dict for insertion
            note_dict = note.dict()
            
            # Check if note already exists
            result = await session.execute(
                select(NotesModel).where(NotesModel.id == note.id)
            )
            existing = result.scalars().first()
            
            if existing:
                # Update existing note
                stmt = update(NotesModel).where(NotesModel.id == note.id).values(**note_dict)
                await session.execute(stmt)
            else:
                # Insert new note
                stmt = insert(NotesModel).values(**note_dict)
                await session.execute(stmt)
                
            if local_session:
                await session.commit()
            
            return note
        except Exception as e:
            if local_session:
                await session.rollback()
            logger.error(f"Error creating note: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_note(self, note_id: str, session: Optional[AsyncSession] = None) -> Optional[Notes]:
        """Get a note by ID"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for note
            result = await session.execute(
                select(NotesModel).where(NotesModel.id == note_id)
            )
            note_model = result.scalars().first()
            
            if not note_model:
                return None
                
            # Convert model to Notes object
            note_dict = {c.name: getattr(note_model, c.name) for c in note_model.__table__.columns}
            
            # Parse datetime strings if needed
            if 'created_at' in note_dict and isinstance(note_dict['created_at'], str):
                note_dict['created_at'] = datetime.fromisoformat(note_dict['created_at'])
            if 'updated_at' in note_dict and isinstance(note_dict['updated_at'], str):
                note_dict['updated_at'] = datetime.fromisoformat(note_dict['updated_at'])
            
            return Notes.from_dict(note_dict)
        except Exception as e:
            logger.error(f"Error getting note: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def update_note(self, note: Notes, session: Optional[AsyncSession] = None) -> Notes:
        """Update an existing note"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Set updated_at timestamp
            note.updated_at = datetime.utcnow()
            
            # Convert note to dict for update
            note_dict = note.dict()
            
            # Update note
            stmt = update(NotesModel).where(NotesModel.id == note.id).values(**note_dict)
            await session.execute(stmt)
            
            if local_session:
                await session.commit()
            
            return note
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def delete_note(self, note_id: str, session: Optional[AsyncSession] = None) -> bool:
        """Delete a note"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Delete note
            result = await session.execute(
                delete(NotesModel).where(NotesModel.id == note_id)
            )
            
            if local_session:
                await session.commit()
            
            # Check if anything was deleted
            return result.rowcount > 0
        except Exception as e:
            if local_session:
                await session.rollback()
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_document_notes(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Notes]:
        """Get all notes for a document"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for notes
            result = await session.execute(
                select(NotesModel).where(NotesModel.document_id == document_id)
            )
            note_models = result.scalars().all()
            
            # Convert models to Notes objects
            notes = []
            for model in note_models:
                note_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Parse datetime strings if needed
                if 'created_at' in note_dict and isinstance(note_dict['created_at'], str):
                    note_dict['created_at'] = datetime.fromisoformat(note_dict['created_at'])
                if 'updated_at' in note_dict and isinstance(note_dict['updated_at'], str):
                    note_dict['updated_at'] = datetime.fromisoformat(note_dict['updated_at'])
                
                notes.append(Notes.from_dict(note_dict))
            
            return notes
        except Exception as e:
            logger.error(f"Error getting document notes: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_block_notes(self, block_id: str, session: Optional[AsyncSession] = None) -> List[Notes]:
        """Get all notes for a specific block"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for notes
            result = await session.execute(
                select(NotesModel).where(NotesModel.block_id == block_id)
            )
            note_models = result.scalars().all()
            
            # Convert models to Notes objects
            notes = []
            for model in note_models:
                note_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Parse datetime strings if needed
                if 'created_at' in note_dict and isinstance(note_dict['created_at'], str):
                    note_dict['created_at'] = datetime.fromisoformat(note_dict['created_at'])
                if 'updated_at' in note_dict and isinstance(note_dict['updated_at'], str):
                    note_dict['updated_at'] = datetime.fromisoformat(note_dict['updated_at'])
                
                notes.append(Notes.from_dict(note_dict))
            
            return notes
        except Exception as e:
            logger.error(f"Error getting block notes: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_conversation_notes(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Notes]:
        """Get all notes associated with a conversation"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for notes
            result = await session.execute(
                select(NotesModel).where(NotesModel.conversation_id == conversation_id)
            )
            note_models = result.scalars().all()
            
            # Convert models to Notes objects
            notes = []
            for model in note_models:
                note_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Parse datetime strings if needed
                if 'created_at' in note_dict and isinstance(note_dict['created_at'], str):
                    note_dict['created_at'] = datetime.fromisoformat(note_dict['created_at'])
                if 'updated_at' in note_dict and isinstance(note_dict['updated_at'], str):
                    note_dict['updated_at'] = datetime.fromisoformat(note_dict['updated_at'])
                
                notes.append(Notes.from_dict(note_dict))
            
            return notes
        except Exception as e:
            logger.error(f"Error getting conversation notes: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
    
    async def get_notes_by_criteria(self, criteria: Dict[str, Any], session: Optional[AsyncSession] = None) -> List[Notes]:
        """Get notes matching the provided criteria"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Build query with dynamic criteria
            query = select(NotesModel)
            
            # Add all criteria as filters
            for key, value in criteria.items():
                if hasattr(NotesModel, key):
                    query = query.where(getattr(NotesModel, key) == value)
            
            # Execute query
            result = await session.execute(query)
            models = result.scalars().all()
            
            # Convert to Notes objects
            notes = []
            for model in models:
                note_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Parse datetime strings if needed
                if 'created_at' in note_dict and isinstance(note_dict['created_at'], str):
                    note_dict['created_at'] = datetime.fromisoformat(note_dict['created_at'])
                if 'updated_at' in note_dict and isinstance(note_dict['updated_at'], str):
                    note_dict['updated_at'] = datetime.fromisoformat(note_dict['updated_at'])
                
                notes.append(Notes.from_dict(note_dict))
            
            return notes
        except Exception as e:
            logger.error(f"Error in get_notes_by_criteria: {str(e)}")
            raise e
        finally:
            if local_session:
                await session.close()
