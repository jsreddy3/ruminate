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
import contextlib
from typing import Dict, List, Optional, Tuple, Any, Callable, AsyncContextManager
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import nullcontext
from asyncio import create_task

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
        
        self.get_session = self._create_session_factory()
        
        logger.debug("AgentRabbitholeService initialized")
    
    def _create_session_factory(self) -> Callable[[], AsyncContextManager[AsyncSession]]:
        """Returns a function that creates database sessions"""
        from src.api.dependencies import db_session_factory
        
        # Return a callable that creates an async context manager for sessions
        @contextlib.asynccontextmanager
        async def session_factory():
            session = db_session_factory()
            try:
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                raise e
            finally:
                await session.close()
        
        return session_factory
    
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
                            session: Optional[AsyncSession] = None,
                            skip_user_message_creation: bool = False,
                            existing_user_message_id: Optional[str] = None) -> Message:
        """
        Process a user message for an agent rabbithole conversation.
        This initiates the agent's exploration and returns the final answer.
        
        Args:
            conversation_id: The ID of the conversation
            content: The content of the message
            parent_id: The ID of the parent message
            session: Optional database session
            skip_user_message_creation: If True, assumes the user message already exists
            existing_user_message_id: If skip_user_message_creation is True, this is the ID of the existing user message
        """
        # logger.info(f"Processing agent message for conversation: {conversation_id}")
        # logger.debug(f"Message content: {content[:50]}{'...' if len(content) > 50 else ''}")
        
        # Use provided session or create a new one for initial database operations
        async with self.get_session() if session is None else contextlib.nullcontext(session) as db_session:
            # Create user message only if not skipped
            if skip_user_message_creation and existing_user_message_id:
                # Use the existing user message ID
                user_msg_id = existing_user_message_id
                # Retrieve the existing message for consistency
                user_msg = await self.conversation_repo.get_message(user_msg_id, db_session)
                if not user_msg:
                    raise ValueError(f"User message {user_msg_id} not found")
            else:
                # Create user message and get required data for agent processing
                user_msg = await self.conversation_manager.create_user_message(
                    conversation_id=conversation_id,
                    content=content,
                    parent_id=parent_id,
                    session=db_session
                )
            
            # Get conversation
            conversation = await self.conversation_repo.get_conversation(conversation_id, db_session)
            if not conversation:
                raise ValueError(f"Conversation {conversation_id} not found")
            
            # Get the active thread
            active_thread = await self.conversation_repo.get_active_thread(conversation_id, db_session)
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
        
        # Run the agent loop without holding the DB session
        # Pass session factory instead of session
        # logger.info(f"Starting agent exploration loop for conversation: {conversation_id}")
        final_answer = await self.agent_loop_runner.run_agent_loop(
            agent_state=agent_state,
            active_thread=active_thread,
            session_factory=self.get_session
        )
        # logger.info(f"Agent exploration completed with answer length: {len(final_answer)}")
        
        # Create new session for final database updates
        async with self.get_session() if session is None else contextlib.nullcontext(session) as db_session:
            # Update active thread to include user message
            if user_msg.id not in active_thread:
                active_thread.append(user_msg.id)
                await self.conversation_repo.update_active_thread(conversation_id, active_thread, db_session)
                # logger.debug("Updated active thread with user message ID")
            
            # Get the final answer message that was created by the agent loop
            # It should be the last message in the active thread
            assistant_msg_id = active_thread[-1] if active_thread else None
            if assistant_msg_id:
                assistant_msg = await self.conversation_repo.get_message(assistant_msg_id, db_session)
            else:
                # This should rarely happen, but as a fallback create a message with the final answer
                logger.warning("No assistant message found in active thread after agent loop")
                assistant_msg = await self.conversation_manager.create_ai_message(
                    conversation_id=conversation_id,
                    content=final_answer,
                    parent_id=user_msg.id,
                    session=db_session,
                    metadata={"message_type": "final_answer"}
                )
                # Update active thread
                active_thread.append(assistant_msg.id)
                await self.conversation_repo.update_active_thread(conversation_id, active_thread, db_session)
        
        # Send completion event
        if self.sse_manager:
            await self.sse_manager.send_event(
                conversation_id, 
                "agent_completed", 
                {"message": "Agent has completed the task."}
            )
        
        return assistant_msg

    async def edit_agent_message(
        self,
        conversation_id: str,
        message_id: str,
        new_content: str,
        session: Optional[AsyncSession] = None,
    ) -> Tuple[str, str]:

        log = logger.getChild("edit_agent_message")

        async with self.get_session() if session is None else nullcontext(session) as db:
            # 1 ───────── fetch original
            original = await self.conversation_repo.get_message(message_id, db)
            if not original:
                log.error("✖ original %s not found", message_id)
                raise ValueError(f"Message {message_id} not found")
            logger.info("① original  id=%s  parent=%s", original.id, original.parent_id)

            # 2 ───────── resolve parent
            if original.parent_id:
                parent = await self.conversation_repo.get_message(original.parent_id, db)
            else:
                parent = await self.conversation_repo.get_root_message(conversation_id, db)

            if not parent:
                log.error("✖ parent for %s not found", message_id)
                raise ValueError(f"Parent message for {message_id} not found")
            logger.info("② parent    id=%s  active_child=%s", parent.id, parent.active_child_id)

            # 3 ───────── create sibling user message
            edited_user = await self.conversation_manager.create_user_message(
                conversation_id=conversation_id,
                content=new_content,
                parent_id=parent.id,
                session=db,
            )
            logger.info("③ edited    id=%s (new sibling)", edited_user.id)

            # 4 ───────── flip parent pointer
            parent.active_child_id = edited_user.id
            parent.children.append(edited_user)
            await db.flush()                       # keep ORM state in‑sync
            logger.info("④ parent.active_child_id → %s  (#children=%d)",
                      parent.active_child_id, len(parent.children))

            # 5 ───────── assistant placeholder
            assistant_placeholder = await self.conversation_manager.create_ai_message(
                conversation_id=conversation_id,
                content="",
                parent_id=edited_user.id,
                session=db,
                metadata={"message_type": "placeholder"},
            )
            logger.info("⑤ placeholder id=%s parent=%s", assistant_placeholder.id, edited_user.id)

            # 6 ───────── rebuild active_thread
            active_thread = await self.conversation_repo.get_active_thread(conversation_id, db)
            logger.info("⑥ active_thread BEFORE  %s", active_thread)

            try:
                cut = active_thread.index(parent.id) + 1
                active_thread = active_thread[:cut]
            except ValueError:
                active_thread = [parent.id]
                logger.info("parent not in thread — starting fresh branch")

            active_thread += [edited_user.id, assistant_placeholder.id]
            logger.info("⑦ active_thread AFTER   %s", active_thread)

            await self.conversation_repo.update_active_thread(conversation_id, active_thread, db)
            await db.commit()
            log.info("✓ commit  branch=%s→%s→%s",
                    parent.id, edited_user.id, assistant_placeholder.id)

        # 7 ───────── notify & kick exploration
        if self.sse_manager:
            await self.sse_manager.send_event(
                conversation_id, "agent_started",
                {"message": "Agent is analyzing your edit..."}
            )
            logger.info("⇢ sent SSE  agent_started")

        async def _run():
            await self.send_agent_message(
                conversation_id=conversation_id,
                content=new_content,
                parent_id=edited_user.id,
                # Pass flag to skip creating another user message - use the one we just created
                skip_user_message_creation=True,
                existing_user_message_id=edited_user.id
            )
        create_task(_run())

        return edited_user.id, assistant_placeholder.id


    
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