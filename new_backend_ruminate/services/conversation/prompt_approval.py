# new_backend_ruminate/services/conversation/prompt_approval.py
from typing import Dict, List, Optional
import asyncio
import json
import uuid
from datetime import datetime, timedelta


class PromptApprovalService:
    """Service to handle prompt approval flow for debugging"""
    
    def __init__(self):
        # Store pending prompts waiting for approval
        self._pending_prompts: Dict[str, Dict] = {}
        # Store approval futures to coordinate between endpoints
        self._approval_futures: Dict[str, asyncio.Future] = {}
        
    def create_approval_request(
        self,
        prompt: List[dict],
        conversation_id: str,
        message_id: str,
        metadata: dict = None
    ) -> str:
        """
        Create an approval request and return the approval_id.
        """
        approval_id = str(uuid.uuid4())
        
        # Store the prompt for retrieval
        self._pending_prompts[approval_id] = {
            "id": approval_id,
            "prompt": prompt,
            "conversation_id": conversation_id,
            "message_id": message_id,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending"
        }
        
        # Create a future to wait for approval
        future = asyncio.Future()
        self._approval_futures[approval_id] = future
        
        return approval_id
    
    async def wait_for_approval(self, approval_id: str) -> List[dict]:
        """
        Wait for approval of a previously created request.
        Returns the potentially modified prompt after approval.
        """
        if approval_id not in self._approval_futures:
            raise ValueError(f"Approval request {approval_id} not found")
        
        future = self._approval_futures[approval_id]
        pending = self._pending_prompts.get(approval_id)
        
        if not pending:
            raise ValueError(f"Approval request {approval_id} not found")
        
        try:
            # Wait for approval with timeout (5 minutes)
            approved_prompt = await asyncio.wait_for(
                future, 
                timeout=300  # 5 minutes
            )
            
            # Clean up
            del self._pending_prompts[approval_id]
            del self._approval_futures[approval_id]
            
            return approved_prompt
            
        except asyncio.TimeoutError:
            # Auto-approve after timeout
            original_prompt = pending["prompt"]
            del self._pending_prompts[approval_id]
            del self._approval_futures[approval_id]
            return original_prompt
    
    async def get_pending_prompt(self, approval_id: str) -> Optional[Dict]:
        """Get a pending prompt by approval ID"""
        return self._pending_prompts.get(approval_id)
    
    async def approve_prompt(
        self, 
        approval_id: str, 
        modified_prompt: List[dict] = None,
        auto_approved: bool = False
    ) -> bool:
        """
        Approve a pending prompt, optionally with modifications.
        Returns True if successful, False if approval_id not found.
        """
        if approval_id not in self._approval_futures:
            return False
        
        future = self._approval_futures[approval_id]
        pending = self._pending_prompts.get(approval_id)
        
        if pending:
            pending["status"] = "approved"
            pending["approved_at"] = datetime.utcnow().isoformat()
            pending["auto_approved"] = auto_approved
            
            # Use modified prompt if provided, otherwise use original
            final_prompt = modified_prompt if modified_prompt else pending["prompt"]
            
            # Set the result on the future to unblock the waiting coroutine
            if not future.done():
                future.set_result(final_prompt)
        
        return True
    
    async def reject_prompt(self, approval_id: str, reason: str = "") -> bool:
        """
        Reject a pending prompt.
        Returns True if successful, False if approval_id not found.
        """
        if approval_id not in self._approval_futures:
            return False
        
        future = self._approval_futures[approval_id]
        pending = self._pending_prompts.get(approval_id)
        
        if pending:
            pending["status"] = "rejected"
            pending["rejected_at"] = datetime.utcnow().isoformat()
            pending["rejection_reason"] = reason
        
        # Set an exception on the future
        if not future.done():
            future.set_exception(
                RuntimeError(f"Prompt rejected: {reason or 'No reason provided'}")
            )
        
        # Clean up
        del self._pending_prompts[approval_id]
        del self._approval_futures[approval_id]
        
        return True
    
    def cleanup_expired(self):
        """Remove expired pending prompts"""
        now = datetime.utcnow()
        expired_ids = []
        
        for approval_id, pending in self._pending_prompts.items():
            created_at = datetime.fromisoformat(pending["created_at"])
            if now - created_at > timedelta(minutes=5):
                expired_ids.append(approval_id)
        
        for approval_id in expired_ids:
            if approval_id in self._approval_futures:
                future = self._approval_futures[approval_id]
                if not future.done():
                    future.set_exception(RuntimeError("Approval timeout"))
                del self._approval_futures[approval_id]
            del self._pending_prompts[approval_id]


# Global instance
prompt_approval_service = PromptApprovalService()