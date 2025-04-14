from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.conversation.agent_process_step import AgentProcessStep

class AgentProcessRepository:
    """Interface for repositories that manage agent process steps"""
    
    async def add_process_step(self, step: AgentProcessStep, session: Optional[AsyncSession] = None) -> AgentProcessStep:
        """Add a new agent process step"""
        raise NotImplementedError
    
    async def add_process_steps(self, steps: List[AgentProcessStep], session: Optional[AsyncSession] = None) -> List[AgentProcessStep]:
        """Add multiple agent process steps in one operation"""
        raise NotImplementedError
    
    async def get_process_steps(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[AgentProcessStep]:
        """Get all process steps for a specific conversation"""
        raise NotImplementedError
        
    async def get_process_steps_for_message(self, user_message_id: str, session: Optional[AsyncSession] = None) -> List[AgentProcessStep]:
        """Get all process steps related to a specific user message"""
        raise NotImplementedError
    
    async def update_with_assistant_message(self, user_message_id: str, assistant_message_id: str, session: Optional[AsyncSession] = None) -> None:
        """Update all process steps for a user message with the final assistant message ID"""
        raise NotImplementedError
