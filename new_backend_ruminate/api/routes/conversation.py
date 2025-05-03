# new_backend/api/routes/conversation.py
from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.api.schemas.message import MessageIdsResponse, SendMessageRequest
from new_backend_ruminate.infrastructure.db.bootstrap import get_session
from new_backend_ruminate.dependencies import (
    get_conversation_service,
    get_event_hub,
    get_session,
    get_chat_service,
)
from new_backend_ruminate.services.conversation_service import ConversationService
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.services.chat_service import ChatService

router = APIRouter(prefix="/conversations")

@router.post("/{conv_id}/messages")
async def send_message(
    conv_id: str,
    req: SendMessageRequest,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    chat: ChatService      = Depends(get_chat_service),
):
    return await chat.send_message(
        session=session,
        background=background,
        conv_id=conv_id,
        user_content=req.content,
        parent_id=req.parent_id,
    )

@router.post("/{cid}/messages", response_model=MessageIdsResponse)
async def post_message(
    cid: str,
    req: SendMessageRequest,
    bg: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    user_id, ai_id = await svc.send_message(
        session=session,
        background=bg,
        conv_id=cid,
        user_content=req.content,
        parent_id=req.parent_id,
    )
    return {"user_msg_id": user_id, "ai_msg_id": ai_id}


@router.put("/{cid}/messages/{mid}/edit_streaming", response_model=MessageIdsResponse)
async def edit_message(
    cid: str,
    mid: str,
    req: SendMessageRequest,
    bg: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    edited_id, ai_id = await svc.edit_message_streaming(
        session=session,
        background=bg,
        conv_id=cid,
        msg_id=mid,
        new_content=req.content,
    )
    return {"user_msg_id": edited_id, "ai_msg_id": ai_id}


@router.get("/streams/{msg_id}")
async def stream(msg_id: str, hub: EventStreamHub = Depends(get_event_hub)):
    async def event_source():
        async for chunk in hub.register_consumer(msg_id):
            yield f"data: {chunk}\n\n"
    return StreamingResponse(event_source(), media_type="text/event-stream")


@router.get("/{cid}/thread")
async def get_thread(
    cid: str,
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    return await svc.get_latest_thread(cid, session)


@router.get("/{cid}/tree")
async def get_tree(
    cid: str,
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    return await svc.get_full_tree(cid, session)


@router.get("/{cid}/messages/{mid}/versions")
async def versions(
    cid: str,
    mid: str,
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
):
    return await svc.get_versions(mid, session)
