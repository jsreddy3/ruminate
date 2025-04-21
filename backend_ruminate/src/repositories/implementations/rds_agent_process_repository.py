from typing import List, Optional, Dict, Any
import logging
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from src.models.conversation.agent_process_step import AgentProcessStep, AgentProcessStepModel
from src.repositories.interfaces.agent_process_repository import AgentProcessRepository

logger = logging.getLogger(__name__)

class RDSAgentProcessRepository(AgentProcessRepository):
    """SQLAlchemy implementation of AgentProcessRepository."""
    
    def __init__(self, session_factory):
        """Initialize the repository with a session factory.
        
        Args:
            session_factory: Factory function to create new database sessions
        """
        self.session_factory = session_factory
        logger.debug("RDSAgentProcessRepository initialized")
        
    async def add_process_step(self, step: AgentProcessStep, session: Optional[AsyncSession] = None) -> AgentProcessStep:
        """Add a new agent process step"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Convert to SQLAlchemy model
            step_dict = step.dict()
            
            # Rename metadata to meta_data for SQLAlchemy
            if 'metadata' in step_dict:
                step_dict['meta_data'] = step_dict.pop('metadata')
            
            # Convert datetime to ISO string if it's a datetime object
            if 'created_at' in step_dict and step_dict['created_at'] is not None:
                if hasattr(step_dict['created_at'], 'isoformat'):  # Check if it's a datetime object
                    step_dict['created_at'] = step_dict['created_at'].isoformat()
            
            # Create model
            step_model = AgentProcessStepModel(**step_dict)
            
            # Add to session
            session.add(step_model)
            
            if local_session:
                await session.commit()
                
            return step
        except Exception as e:
            logger.error(f"Error adding agent process step: {e}")
            if local_session:
                await session.rollback()
            raise
        finally:
            if local_session:
                await session.close()
    
    async def add_process_steps(self, steps: List[AgentProcessStep], session: Optional[AsyncSession] = None) -> List[AgentProcessStep]:
        """Add multiple agent process steps in one operation"""
        if not steps:
            return []
            
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Convert to SQLAlchemy models
            step_models = []
            for step in steps:
                step_dict = step.dict()
                
                # Rename metadata to meta_data for SQLAlchemy
                if 'metadata' in step_dict:
                    step_dict['meta_data'] = step_dict.pop('metadata')
                
                # Convert datetime to ISO string if it's a datetime object
                if 'created_at' in step_dict and step_dict['created_at'] is not None:
                    if hasattr(step_dict['created_at'], 'isoformat'):  # Check if it's a datetime object
                        step_dict['created_at'] = step_dict['created_at'].isoformat()
                
                # Create model
                step_models.append(AgentProcessStepModel(**step_dict))
            
            # Add to session
            session.add_all(step_models)
            
            if local_session:
                await session.commit()
                
            return steps
        except Exception as e:
            logger.error(f"Error adding agent process steps: {e}")
            if local_session:
                await session.rollback()
            raise
        finally:
            if local_session:
                await session.close()
    
    async def get_process_steps(self, conversation_id: str, session: Optional[AsyncSession] = None) -> List[AgentProcessStep]:
        """Get all process steps for a specific conversation"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for steps
            query = select(AgentProcessStepModel).where(
                AgentProcessStepModel.conversation_id == conversation_id
            ).order_by(AgentProcessStepModel.step_number)
            
            result = await session.execute(query)
            step_models = result.scalars().all()
            
            # Convert to domain models
            steps = []
            for model in step_models:
                # Create dict from model attributes
                step_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Rename meta_data back to metadata for Pydantic
                if 'meta_data' in step_dict:
                    step_dict['metadata'] = step_dict.pop('meta_data')
                    
                steps.append(AgentProcessStep.from_dict(step_dict))
            
            return steps
        except Exception as e:
            logger.error(f"Error getting agent process steps: {e}")
            raise
        finally:
            if local_session:
                await session.close()
    
    async def get_process_steps_for_message(self, user_message_id: str, session: Optional[AsyncSession] = None) -> List[AgentProcessStep]:
        """Get all process steps related to a specific user message"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for steps
            query = select(AgentProcessStepModel).where(
                AgentProcessStepModel.user_message_id == user_message_id
            ).order_by(AgentProcessStepModel.step_number)
            
            result = await session.execute(query)
            step_models = result.scalars().all()
            
            # Convert to domain models
            steps = []
            for model in step_models:
                # Create dict from model attributes
                step_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Rename meta_data back to metadata for Pydantic
                if 'meta_data' in step_dict:
                    step_dict['metadata'] = step_dict.pop('meta_data')
                    
                steps.append(AgentProcessStep.from_dict(step_dict))
            
            return steps
        except Exception as e:
            logger.error(f"Error getting agent process steps for message: {e}")
            raise
        finally:
            if local_session:
                await session.close()
    
    async def update_with_assistant_message(self, user_message_id: str, assistant_message_id: str, session: Optional[AsyncSession] = None) -> None:
        """Update all process steps for a user message with the final assistant message ID"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Update all steps with this user message ID
            stmt = update(AgentProcessStepModel).where(
                AgentProcessStepModel.user_message_id == user_message_id
            ).values(
                assistant_message_id=assistant_message_id
            )
            
            await session.execute(stmt)
            
            if local_session:
                await session.commit()
        except Exception as e:
            logger.error(f"Error updating agent process steps with assistant message: {e}")
            if local_session:
                await session.rollback()
            raise
        finally:
            if local_session:
                await session.close()
                
    async def get_process_steps_for_assistant_message(self, assistant_message_id: str, session: Optional[AsyncSession] = None) -> List[AgentProcessStep]:
        """Get all process steps related to a specific assistant message"""
        local_session = session is None
        session = session or self.session_factory()
        
        try:
            # Query for steps
            query = select(AgentProcessStepModel).where(
                AgentProcessStepModel.assistant_message_id == assistant_message_id
            ).order_by(AgentProcessStepModel.step_number)
            
            result = await session.execute(query)
            step_models = result.scalars().all()
            
            # Convert to domain models
            steps = []
            for model in step_models:
                # Create dict from model attributes
                step_dict = {c.name: getattr(model, c.name) for c in model.__table__.columns}
                
                # Rename meta_data back to metadata for Pydantic
                if 'meta_data' in step_dict:
                    step_dict['metadata'] = step_dict.pop('meta_data')
                    
                steps.append(AgentProcessStep.from_dict(step_dict))
            
            return steps
        except Exception as e:
            logger.error(f"Error getting agent process steps for assistant message: {e}")
            raise
        finally:
            if local_session:
                await session.close()