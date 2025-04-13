from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.models.conversation.conversation import Conversation
from src.services.conversation.rabbithole_service import RabbitholeConversationService
from src.api.dependencies import get_db, db_session_factory

router = APIRouter(prefix="/rabbitholes", tags=["rabbitholes"])

class CreateRabbitholeRequest(BaseModel):
    document_id: str
    block_id: str
    selected_text: str
    start_offset: int
    end_offset: int
    document_conversation_id: Optional[str] = None

def get_rabbithole_service():
    """Dependency to get the rabbithole service"""
    from src.repositories.implementations.rds_conversation_repository import RDSConversationRepository
    from src.repositories.implementations.rds_document_repository import RDSDocumentRepository
    from src.services.ai.llm_service import LLMService
    
    conversation_repo = RDSConversationRepository(db_session_factory)
    document_repo = RDSDocumentRepository(db_session_factory)
    llm_service = LLMService()
    
    return RabbitholeConversationService(
        conversation_repository=conversation_repo,
        document_repository=document_repo,
    )

@router.post("", response_model=Dict[str, str])
async def create_rabbithole(
    request: CreateRabbitholeRequest,
    rabbithole_service: RabbitholeConversationService = Depends(get_rabbithole_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> Dict[str, str]:
    """Create a new rabbithole conversation from selected text"""
    try:
        conversation_id = await rabbithole_service.create_rabbithole(
            document_id=request.document_id,
            block_id=request.block_id,
            selected_text=request.selected_text,
            start_offset=request.start_offset,
            end_offset=request.end_offset,
            document_conversation_id=request.document_conversation_id,
            session=session
        ) 
        return {"conversation_id": conversation_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/blocks/{block_id}", response_model=List[Dict[str, Any]])
async def get_rabbitholes_for_block(
    block_id: str,
    rabbithole_service: RabbitholeConversationService = Depends(get_rabbithole_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all rabbitholes for a specific block"""
    return await rabbithole_service.get_rabbitholes_for_block(block_id, session)

@router.get("/documents/{document_id}", response_model=List[Dict[str, Any]])
async def get_rabbitholes_for_document(
    document_id: str,
    rabbithole_service: RabbitholeConversationService = Depends(get_rabbithole_service),
    session: Optional[AsyncSession] = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all rabbitholes for a document"""
    return await rabbithole_service.get_rabbitholes_for_document(document_id, session)