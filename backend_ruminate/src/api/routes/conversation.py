from typing import List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.models.conversation.conversation import Conversation
from src.models.conversation.message import Message
from src.services.conversation.chat_service import ChatService
from src.api.dependencies import get_chat_service, get_db
from src.api.chat_sse_manager import chat_sse_manager

router = APIRouter(prefix="/conversations", tags=["conversations"])

class SendMessageRequest(BaseModel):
    content: str
    parent_id: str
    active_thread_ids: List[str]
    selected_block_id: Optional[str] = None

class EditMessageRequest(BaseModel):
    content: str
    active_thread_ids: List[str]

@router.post("", response_model=Conversation)
async def create_conversation(
    document_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Conversation:
    """Create a new conversation"""
    return await chat_service.create_conversation(document_id, session)

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

@router.post("/{conversation_id}/messages", response_model=Tuple[str, str])
async def send_message(
    conversation_id: str,
    request: SendMessageRequest,
    background_tasks: BackgroundTasks,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Tuple[str, str]:
    """Send a message in a conversation and start streaming the response."""
    try:
        return await chat_service.send_message(
            background_tasks=background_tasks,
            conversation_id=conversation_id, 
            content=request.content, 
            parent_id=request.parent_id,
            active_thread_ids=request.active_thread_ids,
            selected_block_id=request.selected_block_id,
            # No session provided - service will manage transactions around LLM call
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{conversation_id}/messages/{message_id}/stream")
async def stream_message_response(
    conversation_id: str,
    message_id: str
):
    """Endpoint to stream content chunks for a specific AI message ID."""
    logger.info(f"SSE connection requested for message_id: {message_id}")
    try:
        return StreamingResponse(
            chat_sse_manager.subscribe_to_stream(message_id),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Error setting up SSE stream for message {message_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start stream: {e}")

@router.get("/document/{document_id}", response_model=List[Conversation])
async def get_document_conversations(
    document_id: str,
    chat_service: ChatService = Depends(get_chat_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Conversation]:
    """Get all conversations for a document"""
    return await chat_service.get_document_conversations(document_id, session)

@router.put("/{conversation_id}/messages/{message_id}", response_model=tuple[Message, str])
async def edit_message(
    conversation_id: str,
    message_id: str,
    request: EditMessageRequest,
    chat_service: ChatService = Depends(get_chat_service),
    # Session is now managed by the service to handle LLM transaction splitting
) -> Tuple[Message, str]:
    """Edit a message in a conversation and generate a new AI response"""
    try:
        return await chat_service.edit_message(
            message_id, 
            request.content, 
            active_thread_ids=request.active_thread_ids,
            # No session provided - service will manage transactions around LLM call
        )
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
        logger.info(f"Getting message tree for conversation: {conversation_id}")
        
        # Add pre-execution logging
        logger.info(f"Beginning chat_service.get_message_tree call for {conversation_id}")
        
        try:
            message_tree = await chat_service.get_message_tree(conversation_id, session)
            
            # Log message count to diagnose potential size issues
            message_count = len(message_tree) if message_tree else 0
            logger.info(f"Retrieved {message_count} messages for conversation {conversation_id}")
            
            # Check for circular references before attempting to log the full tree
            try:
                # Log just the IDs of messages to avoid serializing the whole tree
                message_ids = [msg.id for msg in message_tree]
                logger.info(f"Message IDs in tree: {message_ids[:10]}{'...' if len(message_ids) > 10 else ''}")
            except Exception as ref_err:
                logger.error(f"Error accessing message IDs: {str(ref_err)}")
            
            # Return the message tree - this is where serialization might fail
            logger.info(f"Attempting to return message tree for {conversation_id}")
            return message_tree
            
        except Exception as inner_e:
            logger.error(f"Error in get_message_tree service call: {str(inner_e)}", exc_info=True)
            raise inner_e
            
    except ValueError as e:
        logger.error(f"ValueError in get_message_tree: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in get_message_tree endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving message tree: {str(e)}")