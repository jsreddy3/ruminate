from abc import ABC, abstractmethod
from typing import List, Optional, TypeVar, Dict, Any
from src.models.notes.notes import Notes

DBSession = TypeVar('DBSession')

class NotesRepository(ABC):
    @abstractmethod
    async def create_note(self, note: Notes, session: Optional[DBSession] = None) -> Notes:
        """Create a new note"""
        pass
    
    @abstractmethod
    async def get_note(self, note_id: str, session: Optional[DBSession] = None) -> Optional[Notes]:
        """Get a note by ID"""
        pass
    
    @abstractmethod
    async def update_note(self, note: Notes, session: Optional[DBSession] = None) -> Notes:
        """Update an existing note"""
        pass
    
    @abstractmethod
    async def delete_note(self, note_id: str, session: Optional[DBSession] = None) -> bool:
        """Delete a note"""
        pass
    
    @abstractmethod
    async def get_document_notes(self, document_id: str, session: Optional[DBSession] = None) -> List[Notes]:
        """Get all notes for a document"""
        pass
    
    @abstractmethod
    async def get_block_notes(self, block_id: str, session: Optional[DBSession] = None) -> List[Notes]:
        """Get all notes for a specific block"""
        pass
    
    @abstractmethod
    async def get_conversation_notes(self, conversation_id: str, session: Optional[DBSession] = None) -> List[Notes]:
        """Get all notes associated with a conversation"""
        pass
    
    @abstractmethod
    async def get_notes_by_criteria(self, criteria: Dict[str, Any], session: Optional[DBSession] = None) -> List[Notes]:
        """Get notes matching the provided criteria"""
        pass
