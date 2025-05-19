# new_backend_ruminate/dependencies.py

"""
Centralised FastAPI dependency providers.

Lifetimes
---------
* module-level singletons → created once at import time
* request-scoped objects  → yielded by functions that FastAPI wraps
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.config import settings
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.infrastructure.conversation.rds_conversation_repository import RDSConversationRepository
from new_backend_ruminate.infrastructure.llm.openai_llm import OpenAILLM
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.services.agent.service import AgentService
from new_backend_ruminate.context.builder import ContextBuilder
from new_backend_ruminate.infrastructure.db.bootstrap import get_session as get_db_session
from new_backend_ruminate.context.renderers.agent import register_agent_renderers

register_agent_renderers()

# ────────────────────────── singletons ─────────────────────────── #

_hub = EventStreamHub()
_repo = RDSConversationRepository()
_llm  = OpenAILLM(
    api_key=settings().openai_api_key,
    model=settings().openai_model,
)
_ctx_builder = ContextBuilder()
_conversation_service = ConversationService(_repo, _llm, _hub, _ctx_builder)
_agent_service = AgentService(_repo, _llm, _hub, _ctx_builder)
# ─────────────────────── DI provider helpers ───────────────────── #

def get_event_hub() -> EventStreamHub:
    """Return the process-wide in-memory hub (singleton)."""
    return _hub

def get_context_builder() -> ContextBuilder:
    """Return the singleton ContextBuilder; stateless, safe to share."""
    return _ctx_builder

def get_conversation_service() -> ConversationService:
    """Return the singleton ConversationService; stateless, safe to share."""
    return _conversation_service

def get_agent_service() -> AgentService:
    """Return the singleton AgentService; stateless, safe to share."""
    return _agent_service

# If you ever need the repository or LLM directly in a router:
def get_conversation_repository() -> RDSConversationRepository:
    return _repo


def get_llm_service() -> OpenAILLM:
    return _llm


# Re-export get_session so routers can do Depends(deps.get_session)
def get_session() -> AsyncSession:  # type: ignore[return-type]
    return get_db_session()  # from bootstrap
