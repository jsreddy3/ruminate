# new_backend_ruminate/api/conversation/prompt_approval_routes.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from new_backend_ruminate.dependencies import get_current_user
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.services.conversation.prompt_approval import prompt_approval_service

router = APIRouter(prefix="/prompt-approval")


class PromptApprovalRequest(BaseModel):
    approval_id: str
    modified_prompt: Optional[List[Dict[str, str]]] = None


class PromptRejectionRequest(BaseModel):
    approval_id: str
    reason: Optional[str] = ""


@router.get("/{approval_id}")
async def get_pending_prompt(
    approval_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a pending prompt awaiting approval"""
    pending = await prompt_approval_service.get_pending_prompt(approval_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return pending


@router.post("/{approval_id}/approve")
async def approve_prompt(
    approval_id: str,
    request: PromptApprovalRequest,
    current_user: User = Depends(get_current_user)
):
    """Approve a pending prompt, optionally with modifications"""
    success = await prompt_approval_service.approve_prompt(
        approval_id=approval_id,
        modified_prompt=request.modified_prompt
    )
    if not success:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return {"status": "approved", "approval_id": approval_id}


@router.post("/{approval_id}/reject")
async def reject_prompt(
    approval_id: str,
    request: PromptRejectionRequest,
    current_user: User = Depends(get_current_user)
):
    """Reject a pending prompt"""
    success = await prompt_approval_service.reject_prompt(
        approval_id=approval_id,
        reason=request.reason
    )
    if not success:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return {"status": "rejected", "approval_id": approval_id}


@router.get("/pending/list")
async def list_pending_prompts(
    current_user: User = Depends(get_current_user)
):
    """List all pending approval requests"""
    # Clean up expired ones first
    prompt_approval_service.cleanup_expired()
    
    # Return all pending prompts
    pending = []
    for approval_id, prompt_data in prompt_approval_service._pending_prompts.items():
        if prompt_data["status"] == "pending":
            pending.append({
                "approval_id": approval_id,
                "conversation_id": prompt_data["conversation_id"],
                "message_id": prompt_data["message_id"],
                "created_at": prompt_data["created_at"]
            })
    
    return {"pending_approvals": pending}