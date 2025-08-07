# new_backend_ruminate/services/document/definition_approval.py
from typing import Dict, List, Optional
import asyncio
import json
import uuid
from datetime import datetime, timedelta


class DefinitionApprovalService:
    """Service to handle definition prompt approval flow for debugging"""
    
    def __init__(self):
        # Store pending definition prompts waiting for approval
        self._pending_definitions: Dict[str, Dict] = {}
        # Store approval futures to coordinate between endpoints
        self._approval_futures: Dict[str, asyncio.Future] = {}
        
    def create_approval_request(
        self,
        term: str,
        document_id: str,
        block_id: str,
        system_prompt: str,
        user_prompt: str,
        full_context: str,
        metadata: dict = None
    ) -> str:
        """
        Create an approval request for a definition and return the approval_id.
        """
        approval_id = str(uuid.uuid4())
        
        # Store the definition prompt for retrieval
        self._pending_definitions[approval_id] = {
            "id": approval_id,
            "term": term,
            "document_id": document_id,
            "block_id": block_id,
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "full_context": full_context,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending"
        }
        
        # Create a future to wait for approval
        future = asyncio.Future()
        self._approval_futures[approval_id] = future
        
        return approval_id
    
    async def wait_for_approval(self, approval_id: str) -> Dict[str, str]:
        """
        Wait for approval of a previously created request.
        Returns the potentially modified prompts after approval.
        """
        if approval_id not in self._approval_futures:
            raise ValueError(f"Approval request {approval_id} not found")
        
        future = self._approval_futures[approval_id]
        pending = self._pending_definitions.get(approval_id)
        
        if not pending:
            raise ValueError(f"Approval request {approval_id} not found")
        
        try:
            # Wait for approval with timeout (5 minutes)
            approved_prompts = await asyncio.wait_for(
                future, 
                timeout=300  # 5 minutes
            )
            
            # Clean up
            del self._pending_definitions[approval_id]
            del self._approval_futures[approval_id]
            
            return approved_prompts
            
        except asyncio.TimeoutError:
            # Auto-approve after timeout
            original_prompts = {
                "system_prompt": pending["system_prompt"],
                "user_prompt": pending["user_prompt"]
            }
            del self._pending_definitions[approval_id]
            del self._approval_futures[approval_id]
            return original_prompts
    
    async def get_pending_definition(self, approval_id: str) -> Optional[Dict]:
        """Get a pending definition by approval ID"""
        return self._pending_definitions.get(approval_id)
    
    async def approve_definition(
        self, 
        approval_id: str, 
        modified_system_prompt: Optional[str] = None,
        modified_user_prompt: Optional[str] = None,
        auto_approved: bool = False
    ) -> bool:
        """
        Approve a pending definition, optionally with modifications.
        Returns True if successful, False if approval_id not found.
        """
        if approval_id not in self._approval_futures:
            return False
        
        future = self._approval_futures[approval_id]
        pending = self._pending_definitions.get(approval_id)
        
        if pending:
            pending["status"] = "approved"
            pending["approved_at"] = datetime.utcnow().isoformat()
            pending["auto_approved"] = auto_approved
            
            # Use modified prompts if provided, otherwise use original
            final_prompts = {
                "system_prompt": modified_system_prompt if modified_system_prompt else pending["system_prompt"],
                "user_prompt": modified_user_prompt if modified_user_prompt else pending["user_prompt"]
            }
            
            # Set the result on the future to unblock the waiting coroutine
            if not future.done():
                future.set_result(final_prompts)
        
        return True
    
    async def reject_definition(self, approval_id: str, reason: str = "") -> bool:
        """
        Reject a pending definition.
        Returns True if successful, False if approval_id not found.
        """
        if approval_id not in self._approval_futures:
            return False
        
        future = self._approval_futures[approval_id]
        pending = self._pending_definitions.get(approval_id)
        
        if pending:
            pending["status"] = "rejected"
            pending["rejected_at"] = datetime.utcnow().isoformat()
            pending["rejection_reason"] = reason
        
        # Set an exception on the future
        if not future.done():
            future.set_exception(
                RuntimeError(f"Definition rejected: {reason or 'No reason provided'}")
            )
        
        # Clean up
        del self._pending_definitions[approval_id]
        del self._approval_futures[approval_id]
        
        return True
    
    def cleanup_expired(self):
        """Remove expired pending definitions"""
        now = datetime.utcnow()
        expired_ids = []
        
        for approval_id, pending in self._pending_definitions.items():
            created_at = datetime.fromisoformat(pending["created_at"])
            if now - created_at > timedelta(minutes=5):
                expired_ids.append(approval_id)
        
        for approval_id in expired_ids:
            if approval_id in self._approval_futures:
                future = self._approval_futures[approval_id]
                if not future.done():
                    future.set_exception(RuntimeError("Approval timeout"))
                del self._approval_futures[approval_id]
            del self._pending_definitions[approval_id]


# Global instance
definition_approval_service = DefinitionApprovalService()