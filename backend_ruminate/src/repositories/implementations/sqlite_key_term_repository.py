from typing import List, Dict, Any, Optional
import sqlite3
import json
import logging
from src.models.rumination.key_term_note import KeyTermNote
from src.repositories.interfaces.key_term_repository import KeyTermRepository

logger = logging.getLogger(__name__)

class SQLiteKeyTermRepository(KeyTermRepository):
    """
    SQLite implementation of the KeyTermRepository.
    Uses the same database as other SQLite repositories.
    """
    
    def __init__(self, db_path: str):
        """Initialize with database path."""
        self.db_path = db_path
        self._ensure_tables()
        
    def _get_connection(self) -> sqlite3.Connection:
        """Get a connection to the SQLite database."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable dictionary access to rows
        return conn
        
    def _ensure_tables(self):
        """Ensure the required tables exist."""
        conn = self._get_connection()
        try:
            # Create key term notes table
            conn.execute('''
            CREATE TABLE IF NOT EXISTS key_term_notes (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                chunk_id TEXT NOT NULL,
                chunk_sequence INTEGER NOT NULL,
                term TEXT NOT NULL,
                label TEXT NOT NULL,
                quote TEXT NOT NULL,
                explanation TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id),
                FOREIGN KEY (chunk_id) REFERENCES chunks(id)
            )
            ''')
            
            # Create index on document_id and term for faster lookups
            conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_key_term_notes_document_term
            ON key_term_notes (document_id, term)
            ''')
            
            conn.commit()
        except Exception as e:
            logger.error(f"Error creating key term tables: {str(e)}")
        finally:
            conn.close()
    
    async def create_key_term_note(self, note: KeyTermNote) -> KeyTermNote:
        """Create a new key term note."""
        conn = self._get_connection()
        try:
            # Convert Pydantic model to dict
            note_dict = note.dict()
            
            # Insert into database
            conn.execute('''
            INSERT INTO key_term_notes
            (id, document_id, chunk_id, chunk_sequence, term, label, quote, explanation, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                note_dict["id"],
                note_dict["document_id"],
                note_dict["chunk_id"],
                note_dict["chunk_sequence"],
                note_dict["term"],
                note_dict["label"],
                note_dict["quote"],
                note_dict["explanation"],
                note_dict["created_at"].isoformat() if hasattr(note_dict["created_at"], 'isoformat') else str(note_dict["created_at"])
            ))
            
            conn.commit()
            return note
        except Exception as e:
            logger.error(f"Error creating key term note: {str(e)}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    async def get_notes_by_term(self, document_id: str, term: str) -> List[KeyTermNote]:
        """Get all notes for a specific term in a document."""
        conn = self._get_connection()
        try:
            cursor = conn.execute('''
            SELECT * FROM key_term_notes
            WHERE document_id = ? AND term = ?
            ORDER BY chunk_sequence
            ''', (document_id, term))
            
            notes = []
            for row in cursor:
                note_dict = dict(row)
                # Convert back to KeyTermNote
                notes.append(KeyTermNote(
                    id=note_dict["id"],
                    document_id=note_dict["document_id"],
                    chunk_id=note_dict["chunk_id"],
                    chunk_sequence=note_dict["chunk_sequence"],
                    term=note_dict["term"],
                    label=note_dict["label"],
                    quote=note_dict["quote"],
                    explanation=note_dict["explanation"],
                    created_at=note_dict["created_at"]
                ))
            
            return notes
        except Exception as e:
            logger.error(f"Error getting notes by term: {str(e)}")
            return []
        finally:
            conn.close()
    
    async def get_all_terms(self, document_id: str) -> List[str]:
        """Get all unique terms for a document."""
        conn = self._get_connection()
        try:
            cursor = conn.execute('''
            SELECT DISTINCT term FROM key_term_notes
            WHERE document_id = ?
            ORDER BY term
            ''', (document_id,))
            
            return [row[0] for row in cursor]
        except Exception as e:
            logger.error(f"Error getting all terms: {str(e)}")
            return []
        finally:
            conn.close()
    
    async def get_notes_by_document(self, document_id: str) -> List[KeyTermNote]:
        """Get all key term notes for a document."""
        conn = self._get_connection()
        try:
            cursor = conn.execute('''
            SELECT * FROM key_term_notes
            WHERE document_id = ?
            ORDER BY term, chunk_sequence
            ''', (document_id,))
            
            notes = []
            for row in cursor:
                note_dict = dict(row)
                # Convert back to KeyTermNote
                notes.append(KeyTermNote(
                    id=note_dict["id"],
                    document_id=note_dict["document_id"],
                    chunk_id=note_dict["chunk_id"],
                    chunk_sequence=note_dict["chunk_sequence"],
                    term=note_dict["term"],
                    label=note_dict["label"],
                    quote=note_dict["quote"],
                    explanation=note_dict["explanation"],
                    created_at=note_dict["created_at"]
                ))
            
            return notes
        except Exception as e:
            logger.error(f"Error getting notes by document: {str(e)}")
            return []
        finally:
            conn.close()
