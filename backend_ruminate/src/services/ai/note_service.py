from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from src.models.notes.notes import Notes
from src.repositories.interfaces.notes_repository import NotesRepository
from src.services.ai.context_service import ContextService
from src.services.ai.llm_service import LLMService
from src.models.conversation.message import Message, MessageRole
from uuid import uuid4
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class NoteService:
    """Service for managing notes."""
    
    def __init__(self, notes_repository: NotesRepository):
        """Initialize the note service.
        
        Args:
            notes_repository: Repository for notes operations
        """
        self.notes_repository = notes_repository
        self._context_service = None
        self._llm_service = None
    
    def set_context_service(self, context_service: ContextService):
        """Set the context service.
        
        Args:
            context_service: The context service to use
        """
        self._context_service = context_service
        
    def set_llm_service(self, llm_service: LLMService):
        """Set the LLM service.
        
        Args:
            llm_service: The LLM service to use
        """
        self._llm_service = llm_service
        
    async def create_note(self, note_data: Dict[str, Any], session: Optional[AsyncSession] = None) -> Notes:
        """Create a new note.
        
        Args:
            note_data: Dictionary containing note data
            session: Optional database session
            
        Returns:
            The created note
        """
        # Create a new note instance
        note = Notes(**note_data)
        return await self.notes_repository.create_note(note, session)
    
    async def get_note(self, note_id: str, session: Optional[AsyncSession] = None) -> Optional[Notes]:
        """Get a note by ID.
        
        Args:
            note_id: ID of the note to retrieve
            session: Optional database session
            
        Returns:
            The note if found, None otherwise
        """
        return await self.notes_repository.get_note(note_id, session)
    
    async def update_note(self, note_id: str, update_data: Dict[str, Any], session: Optional[AsyncSession] = None) -> Optional[Notes]:
        """Update a note.
        
        Args:
            note_id: ID of the note to update
            update_data: Dictionary containing fields to update
            session: Optional database session
            
        Returns:
            The updated note if found, None otherwise
        """
        note = await self.notes_repository.get_note(note_id, session)
        if note:
            for key, value in update_data.items():
                if hasattr(note, key):
                    setattr(note, key, value)
            return await self.notes_repository.update_note(note, session)
        return None
    
    async def delete_note(self, note_id: str, session: Optional[AsyncSession] = None) -> bool:
        """Delete a note.
        
        Args:
            note_id: ID of the note to delete
            session: Optional database session
            
        Returns:
            True if deletion was successful, False otherwise
        """
        return await self.notes_repository.delete_note(note_id, session)
    
    async def get_document_notes(self, document_id: str, session: Optional[AsyncSession] = None) -> List[Notes]:
        """Get all notes for a document.
        
        Args:
            document_id: ID of the document
            session: Optional database session
            
        Returns:
            List of notes for the document
        """
        return await self.notes_repository.get_document_notes(document_id, session)
    
    async def get_block_notes(self, block_id: str, session: Optional[AsyncSession] = None) -> List[Notes]:
        """Get all notes for a specific block.
        
        Args:
            block_id: ID of the block
            session: Optional database session
            
        Returns:
            List of notes for the block
        """
        return await self.notes_repository.get_block_notes(block_id, session)
    
    async def get_conversation_notes(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[Notes]:
        """Get all notes associated with a conversation.
        
        Args:
            conversation_id: ID of the conversation
            session: Optional database session
            
        Returns:
            List of notes for the conversation
        """
        return await self.notes_repository.get_conversation_notes(conversation_id, session)
    
    async def auto_generate_note(self, 
                            document_id: str,
                            block_id: str, 
                            conversation_id: str, 
                            message_id: str, 
                            block_sequence_no: Optional[int] = None,
                            session: Optional[AsyncSession] = None) -> Notes:
        """Auto-generate a note based on document, block, and conversation context.
        
        Args:
            document_id: ID of the document
            block_id: ID of the block
            conversation_id: ID of the conversation
            message_id: ID of the message to truncate at
            block_sequence_no: Optional sequence number for the block
            session: Optional database session
            
        Returns:
            The created note with auto-generated content
        """
        if not self._context_service or not self._llm_service:
            raise ValueError("Context service and LLM service must be set for auto-generating notes")
        
        # Get conversation
        conversation = await self._context_service.conversation_repo.get_conversation(conversation_id, session)
        if not conversation:
            raise ValueError(f"Conversation not found with ID: {conversation_id}")
            
        # Verify block exists
        block = await self._context_service.document_repo.get_block(block_id, session)
        if not block:
            raise ValueError(f"Block not found with ID: {block_id}")
            
        # Verify document exists
        if conversation.document_id != document_id:
            # Double-check that the provided document_id is valid
            document = await self._context_service.document_repo.get_document(document_id, session)
            if not document:
                raise ValueError(f"Document not found with ID: {document_id}")
            # The document IDs don't match, which is strange
            raise ValueError(f"Conversation {conversation_id} is not associated with document {document_id}")
        
        # Build context for LLM using the active thread truncated at message_id
        context_messages, included_pages = await self._context_service.enhance_context_for_note_generation(
            conversation,
            message_id,
            session
        )
        
        # Get active thread to determine message roles
        active_thread = await self._context_service.conversation_repo.get_active_thread(conversation_id, session)
        
        # Find the target message in the active thread
        target_message = None
        target_index = -1
        for i, msg in enumerate(active_thread):
            if msg.id == message_id:
                target_message = msg
                target_index = i
                break
                
        if not target_message:
            raise ValueError(f"Message {message_id} not found in active thread of conversation {conversation_id}")
            
        # Get the note generation request template from prompts.yaml
        note_request_content = self._context_service.prompts.get("note_generation", {}).get("user_message", "")
        if not note_request_content:
            # Fallback if not found
            note_request_content = "Can you generate a comprehensive note summarizing our conversation about this content?"
        
        # Handle differently based on whether the target message is from an assistant or user
        is_assistant_message = target_message.role == MessageRole.ASSISTANT
        all_context_messages = None
        
        if is_assistant_message:
            # If it's an assistant message, add a user message asking for a note
            note_request_message = Message(
                id=str(uuid4()),
                conversation_id=conversation_id,
                role=MessageRole.USER,
                content=note_request_content,
                parent_id=message_id,  # Use the truncation message as parent
                version=1,
                created_at=datetime.utcnow()
            )
            
            # Append the note request message to the context
            all_context_messages = context_messages + [note_request_message]
        else:
            # If it's a user message, temporarily replace that message with the note request
            # First, we need to check if there's a previous message to use as parent
            parent_id = None
            if target_index > 0:
                parent_id = active_thread[target_index - 1].id
            
            # Create note request message with the same ID as the user message to replace it
            modified_context_messages = context_messages.copy()
            
            # Find and replace the user message in the context
            for i, msg in enumerate(modified_context_messages):
                if msg.id == message_id:
                    # Replace this message with our note request
                    modified_context_messages[i] = Message(
                        id=msg.id,  # Use the same ID to replace it
                        conversation_id=conversation_id,
                        role=MessageRole.USER,
                        content=note_request_content,
                        parent_id=msg.parent_id,  # Keep original parent
                        version=msg.version,  # Keep original version
                        created_at=msg.created_at  # Keep original timestamp
                    )
                    break
            
            all_context_messages = modified_context_messages
        
        # logger.info("All context messages: ", all_context_messages)
        # Generate the note content using LLM
        note_content = await self._llm_service.generate_response(all_context_messages)
        # logger.info("Note content: ", note_content)
        
        # Create and save the note
        note = Notes(
            document_id=document_id,
            block_id=block_id,
            conversation_id=conversation_id,
            message_id=message_id,
            content=note_content,
            block_sequence_no=block_sequence_no,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Save the note to the database
        return await self.notes_repository.create_note(note, session)
