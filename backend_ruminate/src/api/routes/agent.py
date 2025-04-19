from typing import List, Optional, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import asyncio

from src.models.conversation.message import Message
from src.models.conversation.agent_process_step import AgentProcessStep
from src.services.conversation.agent_rabbithole_service import AgentRabbitholeService
from src.repositories.interfaces.agent_process_repository import AgentProcessRepository
from src.api.dependencies import get_db, get_agent_rabbithole_service, get_agent_sse_manager, get_agent_process_repository


router = APIRouter(prefix="/agent-rabbitholes", tags=["agent-rabbitholes"])

class CreateAgentRabbitholeRequest(BaseModel):
    document_id: str
    block_id: str
    selected_text: str
    start_offset: int
    end_offset: int
    document_conversation_id: Optional[str] = None

class AgentMessageRequest(BaseModel):
    content: str
    parent_id: str

class AgentMessageResponse(BaseModel):
    message_id: str
    content: str
    role: str
    
class AgentStepResponse(BaseModel):
    id: str
    step_type: str
    content: str
    step_number: int
    created_at: str
    metadata: Optional[Dict[str, Any]] = None

@router.post("", response_model=Dict[str, str])
async def create_agent_rabbithole(
    request: CreateAgentRabbitholeRequest,
    agent_service: AgentRabbitholeService = Depends(get_agent_rabbithole_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, str]:
    """Create a new agent rabbithole conversation"""
    try:
        conversation_id = await agent_service.create_agent_rabbithole(
            request.document_id,
            request.block_id,
            request.selected_text,
            request.start_offset,
            request.end_offset,
            request.document_conversation_id,
            session
        )
        
        return {"conversation_id": conversation_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{conversation_id}/messages", response_model=AgentMessageResponse)
async def send_agent_message(
    conversation_id: str,
    request: AgentMessageRequest,
    agent_service: AgentRabbitholeService = Depends(get_agent_rabbithole_service)
) -> AgentMessageResponse:
    """Send a message to an agent rabbithole conversation."""
    try:
        # Service now manages its own database sessions internally
        message = await agent_service.send_agent_message(
            conversation_id,
            request.content,
            request.parent_id
        )
        
        return AgentMessageResponse(
            message_id=message.id,
            content=message.content,
            role=message.role.value
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post(
    "/{conversation_id}/messages/{message_id}/edit",
    response_model=AgentMessageResponse,
)
async def edit_agent_message(
    conversation_id: str,
    message_id: str,
    request: AgentMessageRequest,
    agent_service: AgentRabbitholeService = Depends(get_agent_rabbithole_service),
) -> AgentMessageResponse:
    """
    Edit a user turn inside an agent‑rabbithole conversation.
    Returns the *edited* user‑message id plus the assistant placeholder id.
    """
    print("request:", request)
    edited_id, assistant_id = await agent_service.edit_agent_message(
        conversation_id=conversation_id,
        message_id=message_id,
        new_content=request.content,
    )

    return AgentMessageResponse(
        message_id=edited_id,      # placeholder bubble will use this
        content="",                # filled later by SSE + refresh
        role="assistant",
    )


@router.get("/{conversation_id}/events")
async def event_stream(
    conversation_id: str,
    request: Request,
    sse_manager = Depends(get_agent_sse_manager)
):
    """SSE endpoint for real-time updates on agent progress"""
    
    # Create a queue for this specific client connection
    client_queue = asyncio.Queue()
    
    # Define a client object that the SSE manager can use
    class ClientConnection:
        async def send(self, message: str):
            await client_queue.put(message)
    
    client = ClientConnection()
    
    async def event_generator():
        # Send initial connection event
        yield "event: connected\ndata: {\"conversation_id\": \"" + conversation_id + "\"}\n\n"
        
        # Using the SSE manager directly from app state
        if sse_manager:
            # Register this client connection
            await sse_manager.register_client(conversation_id, client)
            
            try:
                # Keep checking for messages in the queue
                while True:
                    # Either get a message from the queue or send a ping after 20 seconds
                    try:
                        message = await asyncio.wait_for(client_queue.get(), timeout=20)
                        yield message
                        client_queue.task_done()
                    except asyncio.TimeoutError:
                        # No message received for 20 seconds, send ping to keep connection alive
                        yield "event: ping\ndata: {}\n\n"
            except asyncio.CancelledError:
                # Client disconnected
                await sse_manager.unregister_client(conversation_id, client)
            finally:
                # Make sure to clean up
                if sse_manager:
                    await sse_manager.unregister_client(conversation_id, client)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )

@router.get("/{conversation_id}/messages/{message_id}/steps", response_model=List[AgentStepResponse])
async def get_message_steps(
    conversation_id: str,
    message_id: str,
    agent_process_repo: AgentProcessRepository = Depends(get_agent_process_repository),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[AgentStepResponse]:
    """Get agent process steps for a specific message
    
    Args:
        conversation_id: ID of the conversation
        message_id: ID of the assistant message to get steps for
        
    Returns:
        List of agent process steps
    """
    try:
        # First try to get steps by assistant message ID
        steps = await agent_process_repo.get_process_steps_for_assistant_message(message_id, session)
        
        # If no steps found, try by user message ID as fallback
        if not steps:
            steps = await agent_process_repo.get_process_steps_for_message(message_id, session)
        
        # Convert to response model
        return [
            AgentStepResponse(
                id=step.id,
                step_type=step.step_type,
                content=step.content,
                step_number=step.step_number,
                created_at=step.created_at.isoformat() if hasattr(step.created_at, 'isoformat') else step.created_at,
                metadata=step.metadata
            ) for step in steps
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving agent steps: {str(e)}")