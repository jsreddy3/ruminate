from typing import List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message
from src.services.conversation.chat_service import ChatService
from src.api.dependencies import get_chat_service, get_db

router = APIRouter(prefix="/conversations", tags=["conversations"])

class SendMessageRequest(BaseModel):
    content: str
    parent_version_id: Optional[str] = None

class EditMessageRequest(BaseModel):
    content: str

@router.post("", response_model=Conversation)
async def create_conversation(
    document_id: str,
    block_id: Optional[str] = None,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Conversation:
    """Create a new conversation"""
    return await chat_service.create_conversation(document_id, block_id, session)

@router.get("/{conversation_id}", response_model=Conversation)
async def get_conversation(
    conversation_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Conversation:
    """Get a conversation by ID"""
    conversation = await chat_service.get_conversation(conversation_id, session)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

@router.get("/{conversation_id}/thread", response_model=List[Message])
async def get_conversation_thread(
    conversation_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Message]:
    """Get the active thread of messages in a conversation"""
    try:
        return await chat_service.get_active_thread(conversation_id, session)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{conversation_id}/messages", response_model=tuple[Message, str])
async def send_message(
    conversation_id: str,
    request: SendMessageRequest,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Tuple[Message, str]:
    """Send a message in a conversation"""
    try:
        return await chat_service.send_message(
            conversation_id, 
            request.content, 
            parent_version_id=request.parent_version_id,
            session=session
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/document/{document_id}", response_model=List[Conversation])
async def get_document_conversations(
    document_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Conversation]:
    """Get all conversations for a document"""
    return await chat_service.get_document_conversations(document_id, session)

@router.get("/block/{block_id}", response_model=List[Conversation])
async def get_block_conversations(
    block_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Conversation]:
    """Get all conversations for a block"""
    return await chat_service.get_block_conversations(block_id, session)

@router.put("/{conversation_id}/messages/{message_id}", response_model=tuple[Message, str])
async def edit_message(
    conversation_id: str,
    message_id: str,
    request: EditMessageRequest,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Tuple[Message, str]:
    """Edit a message in a conversation and generate a new AI response"""
    try:
        return await chat_service.edit_message(message_id, request.content, session)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{conversation_id}/messages/{message_id}/versions", response_model=List[Message])
async def get_message_versions(
    conversation_id: str,
    message_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Message]:
    """Get all versions of a message"""
    try:
        return await chat_service.get_message_versions(message_id, session)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{conversation_id}/messages/{message_id}/versions/{version_id}", response_model=Message)
async def get_message_version(
    conversation_id: str,
    message_id: str,
    version_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Message:
    """Get a specific version of a message and its subsequent messages"""
    try:
        return await chat_service.get_message_version(conversation_id, message_id, version_id, session)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{conversation_id}/messages/tree", response_model=List[Message])
async def get_message_tree(
    conversation_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Message]:
    """Get the full tree of messages in a conversation, including all versions and branches"""
    try:
        return await chat_service.get_message_tree(conversation_id, session)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))