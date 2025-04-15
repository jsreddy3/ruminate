from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.notes.notes import Notes
from src.services.ai.note_service import NoteService
from src.api.dependencies import get_db, get_note_service

router = APIRouter(prefix="/notes", tags=["notes"])

class NoteCreateRequest(BaseModel):
    document_id: str
    block_id: str
    content: str
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    block_sequence_no: Optional[int] = None
    meta_data: Optional[Dict[str, Any]] = None

class NoteUpdateRequest(BaseModel):
    content: Optional[str] = None
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    block_sequence_no: Optional[int] = None
    meta_data: Optional[Dict[str, Any]] = None

class AutoGenerateNoteRequest(BaseModel):
    document_id: str
    block_id: str
    conversation_id: str
    message_id: str
    block_sequence_no: Optional[int] = None

@router.post("", response_model=Notes)
async def create_note(
    request: NoteCreateRequest,
    note_service: NoteService = Depends(get_note_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Notes:
    """Create a new note"""
    try:
        return await note_service.create_note(request.dict(), session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{note_id}", response_model=Notes)
async def get_note(
    note_id: str,
    note_service: NoteService = Depends(get_note_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Notes:
    """Get a note by ID"""
    note = await note_service.get_note(note_id, session)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.put("/{note_id}", response_model=Notes)
async def update_note(
    note_id: str,
    request: NoteUpdateRequest,
    note_service: NoteService = Depends(get_note_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Notes:
    """Update a note"""
    note = await note_service.update_note(note_id, request.dict(exclude_unset=True), session)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.delete("/{note_id}", response_model=bool)
async def delete_note(
    note_id: str,
    note_service: NoteService = Depends(get_note_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> bool:
    """Delete a note"""
    success = await note_service.delete_note(note_id, session)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return success

@router.get("/document/{document_id}", response_model=List[Notes])
async def get_document_notes(
    document_id: str,
    note_service: NoteService = Depends(get_note_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Notes]:
    """Get all notes for a document"""
    return await note_service.get_document_notes(document_id, session)

@router.get("/block/{block_id}", response_model=List[Notes])
async def get_block_notes(
    block_id: str,
    note_service: NoteService = Depends(get_note_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Notes]:
    """Get all notes for a specific block"""
    return await note_service.get_block_notes(block_id, session)

@router.get("/conversation/{conversation_id}", response_model=List[Notes])
async def get_conversation_notes(
    conversation_id: str,
    note_service: NoteService = Depends(get_note_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Notes]:
    """Get all notes associated with a conversation"""
    return await note_service.get_conversation_notes(conversation_id, session)

@router.post("/auto-generate", response_model=Notes)
async def auto_generate_note(
    request: AutoGenerateNoteRequest,
    note_service: NoteService = Depends(get_note_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Notes:
    """Auto-generate a note based on document, block, and conversation context
    
    This endpoint will:
    1. Retrieve document, block, and conversation data
    2. Truncate conversation at the specified message
    3. Generate a note using LLM based on this context
    4. Store and return the generated note
    
    The note content is automatically generated based on the conversation context.
    """
    try:
        return await note_service.auto_generate_note(
            document_id=request.document_id,
            block_id=request.block_id,
            conversation_id=request.conversation_id,
            message_id=request.message_id,
            block_sequence_no=request.block_sequence_no,
            session=session
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
