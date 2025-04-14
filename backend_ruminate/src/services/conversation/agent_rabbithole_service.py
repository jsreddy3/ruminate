from typing import List, Optional, Dict, Tuple, Any
from src.models.conversation.conversation import Conversation, ConversationType
from src.models.conversation.message import Message, MessageRole
from src.repositories.interfaces.conversation_repository import ConversationRepository
from src.repositories.interfaces.document_repository import DocumentRepository
from src.repositories.interfaces.agent_process_repository import AgentProcessRepository
from src.services.ai.context_service import ContextService
from src.services.ai.llm_service import LLMService
from src.services.conversation.agent.sse_manager import SSEManager
from src.services.conversation.conversation_manager import ConversationManager
from src.services.conversation.agent.agent_loop_runner import AgentLoopRunner
from src.services.conversation.agent.document_exploration_tools import DocumentExplorationTools
from src.services.conversation.agent.response_parser import AgentResponseParser
import logging
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

class AgentRabbitholeService:
    """
    Orchestrator service for agent-powered rabbithole conversations.
    This service coordinates the agent loop, tools, and conversation management.
    """
    def __init__(self, 
                conversation_repository: ConversationRepository,
                document_repository: DocumentRepository,
                agent_process_repository: AgentProcessRepository,
                llm_service: LLMService,
                sse_manager: Optional[SSEManager] = None,
                conversation_manager: Optional[ConversationManager] = None,
                max_iterations: int = 4):
        self.conversation_repo = conversation_repository
        self.document_repo = document_repository
        self.agent_process_repo = agent_process_repository
        self.llm_service = llm_service
        self.context_service = ContextService(conversation_repository, document_repository)
        self.sse_manager = sse_manager
        self.conversation_manager = conversation_manager
        self.max_iterations = max_iterations
        
        # Initialize specialized components
        self.exploration_tools = DocumentExplorationTools(
            document_repository=document_repository,
            conversation_manager=conversation_manager
        )
        
        self.response_parser = AgentResponseParser()
        
        self.agent_loop_runner = AgentLoopRunner(
            llm_service=llm_service,
            tools=self.exploration_tools,
            response_parser=self.response_parser,
            conversation_repository=conversation_repository,
            agent_process_repository=agent_process_repository,
            context_service=self.context_service,
            sse_manager=sse_manager,
            max_iterations=max_iterations
        )
        
        logger.debug("AgentRabbitholeService initialized")
    
    async def create_agent_rabbithole(self,
                                     document_id: str,
                                     block_id: str,
                                     selected_text: str,
                                     start_offset: int,
                                     end_offset: int,
                                     document_conversation_id: Optional[str],
                                     session: Optional[AsyncSession] = None) -> str:
        """Create a new agentic rabbithole conversation that can explore the document"""
        conversation = await self.conversation_manager.create_conversation(
            document_id=document_id,
            session=session,
            conversation_type=ConversationType.AGENT_RABBITHOLE,
            block_id=block_id,
            selected_text=selected_text,
            text_start_offset=start_offset,
            text_end_offset=end_offset,
            template_key="agent_rabbithole"
        )
        return conversation.id
    
    async def send_agent_message(self,
                            conversation_id: str,
                            content: str,
                            parent_id: str,
                            session: Optional[AsyncSession] = None) -> Message:
        """
        Process a user message for an agent rabbithole conversation.
        This initiates the agent's exploration and returns the final answer.
        """
        logger.info(f"Processing agent message for conversation: {conversation_id}")
        logger.debug(f"Message content: {content[:50]}{'...' if len(content) > 50 else ''}")
        
        # Create user message
        user_msg = await self.conversation_manager.create_user_message(
            conversation_id=conversation_id,
            content=content,
            parent_id=parent_id,
            session=session
        )
        
        # Get conversation
        conversation = await self.conversation_repo.get_conversation(conversation_id, session)
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Get the active thread
        active_thread = await self.conversation_repo.get_active_thread(conversation_id, session)
        active_thread = [self._ensure_id_string(msg) for msg in active_thread]
        logger.debug(f"Active thread has {len(active_thread)} message IDs")
        
        # Initialize agent state
        agent_state = {
            "conversation_id": conversation_id,
            "document_id": conversation.document_id,
            "user_message": content,
            "user_message_id": user_msg.id,
            "process_steps": [],
            "exploration_history": [],
            "final_answer": None
        }
        
        # Send a start event to the client
        if self.sse_manager:
            logger.debug(f"Sending agent_started event for conversation: {conversation_id}")
            await self.sse_manager.send_event(
                conversation_id, 
                "agent_started", 
                {"message": "Agent is analyzing your question..."}
            )
        
        # Run the agent loop - note that system_msg is no longer passed
        logger.info(f"Starting agent exploration loop for conversation: {conversation_id}")
        final_answer = await self.agent_loop_runner.run_agent_loop(
            agent_state=agent_state,
            active_thread=active_thread,
            session=session
        )
        logger.info(f"Agent exploration completed with answer length: {len(final_answer)}")
        
        # The final answer message is already created and added to the active_thread 
        # by the AgentLoopRunner, so we just need to ensure our active thread is updated
        
        # Update active thread to include user message
        if user_msg.id not in active_thread:
            active_thread.append(user_msg.id)
            await self.conversation_repo.update_active_thread(conversation_id, active_thread, session)
            logger.debug("Updated active thread with user message ID")
        
        # Get the final answer message that was created by the agent loop
        # It should be the last message in the active thread
        assistant_msg_id = active_thread[-1] if active_thread else None
        if assistant_msg_id:
            assistant_msg = await self.conversation_repo.get_message(assistant_msg_id, session)
        else:
            # This should rarely happen, but as a fallback create a message with the final answer
            logger.warning("No assistant message found in active thread after agent loop")
            assistant_msg = await self.conversation_manager.create_ai_message(
                conversation_id=conversation_id,
                content=final_answer,
                parent_id=user_msg.id,
                session=session,
                metadata={"message_type": "final_answer"}
            )
            # Update active thread
            active_thread.append(assistant_msg.id)
            await self.conversation_repo.update_active_thread(conversation_id, active_thread, session)
        
        # Send completion event
        if self.sse_manager:
            await self.sse_manager.send_event(
                conversation_id, 
                "agent_completed", 
                {"message": "Agent has completed the task."}
            )
        
        return assistant_msg
    
    def _ensure_id_string(self, id_or_message):
        """Convert a Message object to its ID string if needed"""
        if hasattr(id_or_message, 'id'):
            return id_or_message.id
        return id_or_message
    
    def _ensure_id_string(self, id_or_message):
        """Convert a Message object to its ID string if needed"""
        if hasattr(id_or_message, 'id'):
            return id_or_message.id
        return id_or_message