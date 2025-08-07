# new_backend/api/conversation/routes.py
import logging
from fastapi import APIRouter, Depends, BackgroundTasks, Query, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from new_backend_ruminate.api.conversation.schemas import (
    MessageIdsResponse, 
    SendMessageRequest, 
    MessageOut,
    ConversationOut, 
    ConversationInitResponse,
    CreateConversationRequest,
    GenerateNoteRequest,
    GenerateNoteResponse,
    MessageMetadataUpdateRequest
)
from pydantic import BaseModel, Field
from new_backend_ruminate.dependencies import (
    get_conversation_service, 
    get_document_service,
    get_event_hub,
    get_session,
    get_current_user,
    get_current_user_from_query_token,
)
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub

router = APIRouter(prefix="/conversations")

@router.post(
    "",
    status_code=201,
    response_model=ConversationInitResponse,
)
async def create_conversation(
    body: Optional[CreateConversationRequest] = None,
    current_user: User = Depends(get_current_user),
    svc: ConversationService = Depends(get_conversation_service),
):
    """
    Create a new conversation.
    
    For regular conversations: just specify type (CHAT/AGENT)
    For rabbithole conversations: also provide document_id, source_block_id, selected_text, and offsets
    """
    if body is None:
        # Default to CHAT conversation for backward compatibility
        conv_id, root_id = await svc.create_conversation(user_id=current_user.id, conv_type="chat")
    else:
        # Pass all fields to service, it will handle based on type
        conv_id, root_id = await svc.create_conversation(
            user_id=current_user.id,
            conv_type=body.type.value.lower(),
            meta=body.meta,
            document_id=body.document_id,
            source_block_id=body.source_block_id,
            selected_text=body.selected_text,
            text_start_offset=body.text_start_offset,
            text_end_offset=body.text_end_offset
        )
    
    return {"conversation_id": conv_id, "system_msg_id": root_id}

@router.post("/{cid}/messages", response_model=MessageIdsResponse)
async def post_message(
    cid: str,
    req: SendMessageRequest,
    bg: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    svc: ConversationService = Depends(get_conversation_service),
    x_debug_mode: bool = Header(False, description="Enable prompt approval debug mode"),
):
    user_id, ai_id = await svc.send_message(
        background=bg,
        conv_id=cid,
        user_content=req.content,
        parent_id=str(req.parent_id) if req.parent_id is not None else None,
        user_id=current_user.id,
        selected_block_id=req.selected_block_id,
        debug_mode=True,  # HARDCODED TO TRUE
    )
    return {"user_id": user_id, "ai_id": ai_id}


@router.put("/{cid}/messages/{mid}/edit_streaming", response_model=MessageIdsResponse)
async def edit_message(
    cid: str,
    mid: str,
    req: SendMessageRequest,
    bg: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    svc: ConversationService = Depends(get_conversation_service),
    x_debug_mode: bool = Header(False, description="Enable prompt approval debug mode"),
):
    edited_id, ai_id = await svc.edit_message_streaming(
        background=bg,
        conv_id=cid,
        msg_id=mid,
        new_content=req.content,
        user_id=current_user.id,
        selected_block_id=req.selected_block_id,
        debug_mode=True,  # HARDCODED TO TRUE
    )
    return {"user_id": edited_id, "ai_id": ai_id}


@router.patch("/{cid}/messages/{mid}/metadata", response_model=MessageOut)
async def update_message_metadata(
    cid: str,
    mid: str,
    req: MessageMetadataUpdateRequest,
    current_user: User = Depends(get_current_user),
    svc: ConversationService = Depends(get_conversation_service),
    session: AsyncSession = Depends(get_session),
):
    """
    Update metadata for a specific message.
    Used to store references to generated summaries and other metadata.
    """
    updated_message = await svc.update_message_metadata(
        conv_id=cid,
        msg_id=mid,
        metadata=req.meta_data,
        user_id=current_user.id,
        session=session
    )
    return updated_message


@router.get("/streams/{msg_id}")
async def stream(
    msg_id: str, 
    current_user: User = Depends(get_current_user_from_query_token),
    hub: EventStreamHub = Depends(get_event_hub)
):
    async def event_source():
        async for chunk in hub.register_consumer(msg_id):
            yield f"data: {chunk}\n\n"
    return StreamingResponse(event_source(), media_type="text/event-stream")


@router.get("/{cid}/thread", response_model=List[MessageOut])
async def get_thread(
    cid: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    return await svc.get_latest_thread(cid, current_user.id, session)



@router.get("/{cid}/tree", response_model=List[MessageOut])
async def get_tree(
    cid: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    messages = await svc.get_full_tree(cid, current_user.id, session)
    return messages


@router.get("/{cid}/messages/{mid}/versions", response_model=List[MessageOut])
async def versions(
    cid: str,
    mid: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    return await svc.get_versions(mid, current_user.id, session)


@router.get("/{cid}", response_model=ConversationOut)
async def get_conversation(
    cid: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    conversation = await svc.get_conversation(cid, current_user.id, session)
    return conversation


@router.get("", response_model=List[ConversationOut])
async def list_conversations(
    document_id: Optional[str] = Query(None, description="Filter by document ID"),
    source_block_id: Optional[str] = Query(None, description="Filter by source block ID"),
    type: Optional[str] = Query(None, description="Filter by conversation type"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    """
    List conversations with optional filters.
    Useful for finding all rabbitholes for a document or block.
    """
    criteria = {}
    if document_id:
        criteria["document_id"] = document_id
    if source_block_id:
        criteria["source_block_id"] = source_block_id
    if type:
        criteria["type"] = type.upper()
    print("")
    
    conversations = await svc.get_conversations_by_criteria(criteria, current_user.id, session)
    return conversations


@router.post("/{conversation_id}/generate-note", response_model=GenerateNoteResponse)
async def generate_note_from_conversation(
    conversation_id: str,
    request: GenerateNoteRequest,
    current_user: User = Depends(get_current_user),
    conv_svc: ConversationService = Depends(get_conversation_service),
    doc_svc: DocumentService = Depends(get_document_service),
    session: AsyncSession = Depends(get_session)
):
    """
    Generate a note from conversation messages and save it to a block.
    
    This endpoint:
    1. Verifies user owns the conversation
    2. Gets recent messages from the conversation
    3. Generates a note summarizing the conversation
    4. Saves the note as an annotation on the specified block
    
    The generated note appears as a special annotation with metadata indicating
    it was generated from a conversation.
    """
    # Verify user owns the conversation
    conversation = await conv_svc.get_conversation(conversation_id, current_user.id, session)
    
    # Get messages from the conversation
    messages = await conv_svc.get_latest_thread(conversation_id, current_user.id, session)
    
    # Generate and save the note
    result = await doc_svc.generate_note_from_conversation(
        conversation_id=conversation_id,
        block_id=request.block_id,
        messages=messages,
        message_count=request.message_count,
        topic=request.topic,
        user_id=current_user.id,
        session=session
    )
    
    return GenerateNoteResponse(
        note=result["note"],
        note_id=result["note_id"],
        block_id=result["block_id"],
        conversation_id=result["conversation_id"]
    )


