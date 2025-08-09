from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from new_backend_ruminate.dependencies import get_current_user, get_session, get_text_enhancement_service
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.services.document.text_enhancement_service import TextEnhancementService


router = APIRouter(prefix="/documents/{document_id}/text-enhancements", tags=["text-enhancements"])


# Request/Response schemas
class CreateDefinitionRequest(BaseModel):
    block_id: str
    term: str
    text_start_offset: int
    text_end_offset: int
    surrounding_text: str = None


class CreateAnnotationRequest(BaseModel):
    block_id: str
    text: str
    note: str
    text_start_offset: int
    text_end_offset: int


class TextEnhancementResponse(BaseModel):
    id: str
    type: str
    document_id: str
    block_id: str
    user_id: str
    text: str
    text_start_offset: int
    text_end_offset: int
    data: Dict[str, Any]
    created_at: str
    updated_at: str


class TextEnhancementsResponse(BaseModel):
    definitions: List[TextEnhancementResponse]
    annotations: List[TextEnhancementResponse]
    rabbitholes: List[TextEnhancementResponse]




# Routes
@router.get("", response_model=TextEnhancementsResponse)
async def get_text_enhancements(
    document_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: TextEnhancementService = Depends(get_text_enhancement_service)
):
    """Get all text enhancements for a document, grouped by type"""
    result = await svc.get_all_for_document(document_id, current_user.id, session)
    
    return TextEnhancementsResponse(
        definitions=result.get("definitions", []),
        annotations=result.get("annotations", []),
        rabbitholes=result.get("rabbitholes", [])
    )


@router.post("/definitions", response_model=TextEnhancementResponse)
async def create_definition(
    document_id: str,
    request: CreateDefinitionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: TextEnhancementService = Depends(get_text_enhancement_service)
):
    """Create a new definition for a term"""
    enhancement = await svc.create_definition(
        document_id=document_id,
        block_id=request.block_id,
        term=request.term,
        text_start_offset=request.text_start_offset,
        text_end_offset=request.text_end_offset,
        surrounding_text=request.surrounding_text,
        user_id=current_user.id,
        session=session
    )
    
    return TextEnhancementResponse(**enhancement.to_dict())


@router.post("/annotations", response_model=TextEnhancementResponse)
async def create_or_update_annotation(
    document_id: str,
    request: CreateAnnotationRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: TextEnhancementService = Depends(get_text_enhancement_service)
):
    """
    Create or update an annotation.
    - If note is empty string, deletes the annotation
    - If annotation exists at position, updates it
    - Otherwise creates new annotation
    """
    enhancement = await svc.create_annotation(
        document_id=document_id,
        block_id=request.block_id,
        text=request.text,
        note=request.note,
        text_start_offset=request.text_start_offset,
        text_end_offset=request.text_end_offset,
        user_id=current_user.id,
        session=session
    )
    
    if enhancement is None:
        return {"message": "Annotation deleted"}
    
    return TextEnhancementResponse(**enhancement.to_dict())


@router.delete("/{enhancement_id}")
async def delete_text_enhancement(
    document_id: str,
    enhancement_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    svc: TextEnhancementService = Depends(get_text_enhancement_service)
):
    """Delete a text enhancement"""
    success = await svc.delete_enhancement(enhancement_id, current_user.id, session)
    
    if not success:
        raise HTTPException(status_code=404, detail="Text enhancement not found")
    
    return {"message": "Text enhancement deleted"}