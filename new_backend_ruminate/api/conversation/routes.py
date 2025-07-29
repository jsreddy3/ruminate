# new_backend/api/conversation/routes.py
from fastapi import APIRouter, Depends, BackgroundTasks, Query
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
    QuestionOut
)
from pydantic import BaseModel, Field
from new_backend_ruminate.dependencies import (
    get_conversation_service, 
    get_event_hub,
    get_session,
    get_current_user,
    get_current_user_from_query_token,
    get_question_service,
)
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.services.conversation.question_service import QuestionGenerationService
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
    question_service: QuestionGenerationService = Depends(get_question_service),
):
    """
    Create a new conversation.
    
    For regular conversations: just specify type (CHAT/AGENT)
    For rabbithole conversations: also provide document_id, source_block_id, selected_text, and offsets
    """
    if body is None:
        # Default to CHAT conversation for backward compatibility
        conv_id, root_id = await svc.create_conversation(user_id=current_user.id, conv_type="chat")
        # No document, no questions
        questions = []
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
        
        # Generate questions if document_id is provided
        questions = []
        if body.document_id:
            try:
                # Generate questions based on current context
                current_page = body.meta.get("current_page") if body.meta else None
                questions = await question_service.generate_questions_for_conversation(
                    conversation_id=conv_id,
                    document_id=body.document_id,
                    current_page=current_page,
                    question_count=3
                )
            except Exception as e:
                # Don't fail conversation creation if question generation fails
                print(f"Failed to generate questions: {e}")
                questions = []
    
    return {"conversation_id": conv_id, "system_msg_id": root_id, "questions": questions}

@router.post("/{cid}/messages", response_model=MessageIdsResponse)
async def post_message(
    cid: str,
    req: SendMessageRequest,
    bg: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    svc: ConversationService = Depends(get_conversation_service),
):
    user_id, ai_id = await svc.send_message(
        background=bg,
        conv_id=cid,
        user_content=req.content,
        parent_id=str(req.parent_id) if req.parent_id is not None else None,
        user_id=current_user.id,
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
):
    edited_id, ai_id = await svc.edit_message_streaming(
        background=bg,
        conv_id=cid,
        msg_id=mid,
        new_content=req.content,
        user_id=current_user.id,
    )
    return {"user_id": edited_id, "ai_id": ai_id}


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


class MessageTreeResponse(BaseModel):
    messages: List[MessageOut]
    questions: List[QuestionOut] = Field(default_factory=list)

@router.get("/{cid}/tree", response_model=MessageTreeResponse)
async def get_tree(
    cid: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
    question_service: QuestionGenerationService = Depends(get_question_service),
):
    messages = await svc.get_full_tree(cid, current_user.id, session)
    
    # Get questions for this conversation
    try:
        questions = await question_service.get_questions_for_conversation(cid)
    except:
        questions = []
    
    return {"messages": messages, "questions": questions}


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
    question_service: QuestionGenerationService = Depends(get_question_service),
):
    conversation = await svc.get_conversation(cid, current_user.id, session)
    
    # Include questions if they exist
    try:
        questions = await question_service.get_questions_for_conversation(cid)
        conversation.questions = questions
    except:
        conversation.questions = []
    
    return conversation


@router.get("", response_model=List[ConversationOut])
async def list_conversations(
    document_id: Optional[str] = Query(None, description="Filter by document ID"),
    source_block_id: Optional[str] = Query(None, description="Filter by source block ID"),
    type: Optional[str] = Query(None, description="Filter by conversation type"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: ConversationService = Depends(get_conversation_service),
    question_service: QuestionGenerationService = Depends(get_question_service),
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
    
    conversations = await svc.get_conversations_by_criteria(criteria, current_user.id, session)
    
    # Include questions for each conversation
    for conv in conversations:
        try:
            questions = await question_service.get_questions_for_conversation(str(conv.id))
            conv.questions = questions
        except:
            conv.questions = []
    
    return conversations


@router.post("/{cid}/questions", response_model=List[dict])
async def generate_questions(
    cid: str,
    document_id: str = Query(..., description="Document ID for question generation"),
    current_page: Optional[int] = Query(None, description="Current page number"),
    question_count: int = Query(5, description="Number of questions to generate"),
    current_user: User = Depends(get_current_user),
    question_service: QuestionGenerationService = Depends(get_question_service),
):
    """
    Generate contextual questions for a conversation based on document content.
    
    These questions help users explore the document and understand key concepts.
    Questions are generated based on the current page context if provided,
    or document overview if no specific page is given.
    """
    questions = await question_service.generate_questions_for_conversation(
        conversation_id=cid,
        document_id=document_id,
        current_page=current_page,
        question_count=question_count
    )
    return questions


@router.get("/{cid}/questions", response_model=List[dict])
async def get_questions(
    cid: str,
    current_user: User = Depends(get_current_user),
    question_service: QuestionGenerationService = Depends(get_question_service),
):
    """
    Retrieve stored questions for a conversation.
    
    Returns previously generated questions that can be displayed
    as clickable buttons in the UI.
    """
    questions = await question_service.get_questions_for_conversation(cid)
    return questions


@router.put("/{cid}/questions", response_model=List[dict])
async def regenerate_questions(
    cid: str,
    document_id: str = Query(..., description="Document ID for question generation"),
    current_page: Optional[int] = Query(None, description="Current page number"),
    question_count: int = Query(5, description="Number of questions to generate"),
    current_user: User = Depends(get_current_user),
    question_service: QuestionGenerationService = Depends(get_question_service),
):
    """
    Regenerate questions for a conversation.
    
    Useful when the user moves to a different page or wants fresh questions.
    This will delete existing questions and generate new ones.
    """
    questions = await question_service.regenerate_questions(
        conversation_id=cid,
        document_id=document_id,
        current_page=current_page,
        question_count=question_count
    )
    return questions


@router.post("/{cid}/questions/{qid}/use")
async def mark_question_used(
    cid: str,
    qid: str,
    current_user: User = Depends(get_current_user),
    question_service: QuestionGenerationService = Depends(get_question_service),
):
    """
    Mark a question as used when it is clicked/sent.
    """
    await question_service.mark_question_as_used(qid)
    return {"status": "ok"}
