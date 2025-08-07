# new_backend_ruminate/api/document/definition_approval_routes.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from new_backend_ruminate.dependencies import get_current_user
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.services.document.definition_approval import definition_approval_service

router = APIRouter(prefix="/definition-approval")


class DefinitionApprovalRequest(BaseModel):
    approval_id: str
    modified_system_prompt: Optional[str] = None
    modified_user_prompt: Optional[str] = None


class DefinitionRejectionRequest(BaseModel):
    approval_id: str
    reason: Optional[str] = ""


@router.get("/{approval_id}")
async def get_pending_definition(
    approval_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a pending definition awaiting approval"""
    pending = await definition_approval_service.get_pending_definition(approval_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return pending


@router.post("/{approval_id}/approve")
async def approve_definition(
    approval_id: str,
    request: DefinitionApprovalRequest,
    current_user: User = Depends(get_current_user)
):
    """Approve a pending definition, optionally with modifications"""
    success = await definition_approval_service.approve_definition(
        approval_id=approval_id,
        modified_system_prompt=request.modified_system_prompt,
        modified_user_prompt=request.modified_user_prompt
    )
    if not success:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return {"status": "approved", "approval_id": approval_id}


@router.post("/{approval_id}/reject")
async def reject_definition(
    approval_id: str,
    request: DefinitionRejectionRequest,
    current_user: User = Depends(get_current_user)
):
    """Reject a pending definition"""
    success = await definition_approval_service.reject_definition(
        approval_id=approval_id,
        reason=request.reason
    )
    if not success:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return {"status": "rejected", "approval_id": approval_id}


@router.get("/pending/list")
async def list_pending_definitions(
    current_user: User = Depends(get_current_user)
):
    """List all pending approval requests"""
    # Clean up expired ones first
    definition_approval_service.cleanup_expired()
    
    # Return all pending definitions
    pending = []
    for approval_id, definition_data in definition_approval_service._pending_definitions.items():
        if definition_data["status"] == "pending":
            pending.append({
                "approval_id": approval_id,
                "term": definition_data["term"],
                "document_id": definition_data["document_id"],
                "block_id": definition_data["block_id"],
                "created_at": definition_data["created_at"]
            })
    
    return {"pending_approvals": pending}