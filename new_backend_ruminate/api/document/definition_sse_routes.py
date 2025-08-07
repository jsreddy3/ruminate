# new_backend_ruminate/api/document/definition_sse_routes.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import json
import asyncio
from new_backend_ruminate.dependencies import get_current_user, get_document_service
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.services.document.definition_approval import definition_approval_service
from new_backend_ruminate.services.document.service import DocumentService

router = APIRouter(prefix="/documents")


@router.get("/{document_id}/definition-stream/{approval_id}")
async def stream_definition_with_approval(
    document_id: str,
    approval_id: str,
    current_user: User = Depends(get_current_user),
    svc: DocumentService = Depends(get_document_service)
):
    """
    Stream definition generation with approval waiting.
    This endpoint waits for approval and then generates the definition.
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # First, wait for approval
            yield f"data: {json.dumps({'type': 'waiting_for_approval', 'approval_id': approval_id})}\n\n"
            
            # Wait for approval
            approved_prompts = await definition_approval_service.wait_for_approval(approval_id)
            
            yield f"data: {json.dumps({'type': 'approval_received'})}\n\n"
            
            # Get the pending definition metadata
            pending = definition_approval_service._pending_definitions.get(approval_id, {})
            metadata = pending.get("metadata", {})
            
            # Generate the definition with approved prompts
            # This is a bit of a hack - we'll call the service again without debug mode
            # but with the modified prompts
            definition_result = await svc.get_term_definition(
                document_id=document_id,
                block_id=pending.get("block_id"),
                term=pending.get("term"),
                text_start_offset=metadata.get("text_start_offset"),
                text_end_offset=metadata.get("text_end_offset"),
                surrounding_text=metadata.get("surrounding_text"),
                user_id=current_user.id,
                debug_mode=False  # Don't trigger approval again
            )
            
            # Send the final definition
            yield f"data: {json.dumps({'type': 'definition', 'result': definition_result})}\n\n"
            yield "data: [DONE]\n\n"
            
        except RuntimeError as e:
            # Approval was rejected
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Error generating definition: {str(e)}'})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )