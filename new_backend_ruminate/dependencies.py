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
from new_backend_ruminate.infrastructure.document.rds_document_repository import RDSDocumentRepository
from new_backend_ruminate.infrastructure.object_storage.factory import get_object_storage_singleton
from new_backend_ruminate.infrastructure.llm.openai_llm import OpenAILLM
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.services.agent.service import AgentService
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.context.builder import ContextBuilder
from new_backend_ruminate.infrastructure.db.bootstrap import get_session as get_db_session
from new_backend_ruminate.context.renderers.agent import register_agent_renderers
from new_backend_ruminate.infrastructure.document_processing.llm_document_analyzer import LLMDocumentAnalyzer
from new_backend_ruminate.infrastructure.user.rds_user_repository import RDSUserRepository
from new_backend_ruminate.infrastructure.auth.google_oauth_client import GoogleOAuthClient
from new_backend_ruminate.infrastructure.auth.jwt_manager import JWTManager
from new_backend_ruminate.services.auth.service import AuthService

register_agent_renderers()

# ────────────────────────── singletons ─────────────────────────── #

_hub = EventStreamHub()
_repo = RDSConversationRepository()
_document_repo = RDSDocumentRepository()
_user_repo = RDSUserRepository()
_llm  = OpenAILLM(
    api_key=settings().openai_api_key,
    model=settings().openai_model,
)
_ctx_builder = ContextBuilder()
_storage = get_object_storage_singleton()
_document_analyzer = LLMDocumentAnalyzer(_llm)
# Auth components (only initialize if settings are provided)
_google_client = None
_jwt_manager = None
_auth_service = None

if settings().google_client_id and settings().google_client_secret and settings().jwt_secret_key:
    _google_client = GoogleOAuthClient(
        client_id=settings().google_client_id,
        client_secret=settings().google_client_secret,
        redirect_uri=settings().google_redirect_uri,
    )
    _jwt_manager = JWTManager(
        secret_key=settings().jwt_secret_key,
        algorithm=settings().jwt_algorithm,
        expire_hours=settings().jwt_expire_hours,
    )
    _auth_service = AuthService(_user_repo, _google_client, _jwt_manager)
_conversation_service = ConversationService(_repo, _llm, _hub, _ctx_builder)
_agent_service = AgentService(_repo, _llm, _hub, _ctx_builder)
_document_service = DocumentService(_document_repo, _hub, _storage, analyzer=_document_analyzer)
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

def get_document_service() -> DocumentService:
    """Return the singleton DocumentService; stateless, safe to share."""
    return _document_service

def get_auth_service() -> AuthService:
    """Return the singleton AuthService; stateless, safe to share."""
    if _auth_service is None:
        raise HTTPException(status_code=500, detail="Authentication not configured")
    return _auth_service

# If you ever need the repository or LLM directly in a router:
def get_conversation_repository() -> RDSConversationRepository:
    return _repo


def get_llm_service() -> OpenAILLM:
    return _llm


# Re-export get_session so routers can do Depends(deps.get_session)
async def get_session():
    """Get database session for FastAPI dependency injection"""
    async for session in get_db_session():
        yield session

# ─────────────────────── Authentication dependencies ──────────────────── #

from typing import Optional
from fastapi import HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from new_backend_ruminate.domain.user.entities.user import User

security = HTTPBearer(auto_error=False)

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: AsyncSession = Depends(get_session),
    auth_service: AuthService = Depends(get_auth_service),
) -> Optional[User]:
    """Get current user from JWT token, return None if not authenticated"""
    if not credentials:
        return None
    
    try:
        user = await auth_service.validate_token(credentials.credentials, session)
        return user
    except Exception:
        return None

async def get_current_user(
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Get current user from JWT token, raise HTTPException if not authenticated"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

async def get_current_user_from_query_token(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: AsyncSession = Depends(get_session),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Get current user from JWT token in query param (for SSE) or header, raise HTTPException if not authenticated"""
    # Try token from query parameter first (for SSE), then from header
    jwt_token = token or (credentials.credentials if credentials else None)
    
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        user = await auth_service.validate_token(jwt_token, session)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
