from typing import List, Optional
from src.models.rumination.key_term_note import KeyTermNote

class KeyTermRepository:
    """
    Repository for storing and retrieving key term notes.
    """
    async def create_key_term_note(self, note: KeyTermNote) -> KeyTermNote:
        """Create a new key term note."""
        raise NotImplementedError
        
    async def get_notes_by_term(self, document_id: str, term: str) -> List[KeyTermNote]:
        """Get all notes for a specific term in a document."""
        raise NotImplementedError

    async def get_all_terms(self, document_id: str) -> List[str]:
        """Get all unique terms for a document."""
        raise NotImplementedError

    async def get_notes_by_document(self, document_id: str) -> List[KeyTermNote]:
        """Get all key term notes for a document."""
        raise NotImplementedError
