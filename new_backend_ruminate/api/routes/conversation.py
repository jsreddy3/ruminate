# new_backend/api/routes/conversation.py
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.api.schemas.message import SendMessageRequest
from new_backend_ruminate.infrastructure.db.bootstrap import get_session
from new_backend_ruminate.dependencies import get_chat_service
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
