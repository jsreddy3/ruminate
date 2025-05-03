# new_backend/dependencies.py
"""
Centralised FastAPI dependency providers.

Lifetimes
---------
* module-level singletons → created once at import time
* request-scoped objects  → yielded by functions that FastAPI wraps
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.config import settings
from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.domain.repositories.rds_conversation_repository import (
    RDSConversationRepository,
)
from new_backend_ruminate.services.llm.openai_llm import OpenAILLM
from new_backend_ruminate.services.chat_service import ChatService
from new_backend_ruminate.infrastructure.db.bootstrap import get_session


# ────────────────────────── singletons ─────────────────────────── #

_hub = EventStreamHub()
_repo = RDSConversationRepository()
_llm  = OpenAILLM(
    api_key=settings().openai_api_key,
    model=settings().openai_model,
)
_chat_service = ChatService(_repo, _llm, _hub)


# ─────────────────────── DI provider helpers ───────────────────── #

def get_event_hub() -> EventStreamHub:
    """Return the process-wide in-memory hub (singleton)."""
    return _hub


def get_chat_service() -> ChatService:
    """Return the singleton ChatService; stateless, safe to share."""
    return _chat_service


# If you ever need the repository or LLM directly in a router:
def get_conversation_repository() -> RDSConversationRepository:
    return _repo


def get_llm_service() -> OpenAILLM:
    return _llm


# Re-export get_session so routers can do Depends(deps.get_session)
def get_session() -> AsyncSession:  # type: ignore[return-type]
    return get_session()  # from bootstrap
