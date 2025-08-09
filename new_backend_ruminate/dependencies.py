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
from new_backend_ruminate.infrastructure.document.rds_text_enhancement_repository import RDSTextEnhancementRepository
from new_backend_ruminate.infrastructure.object_storage.factory import get_object_storage_singleton
from new_backend_ruminate.infrastructure.llm.openai_llm import OpenAILLM
from new_backend_ruminate.infrastructure.llm.openai_responses_llm import OpenAIResponsesLLM
from new_backend_ruminate.services.conversation.service import ConversationService
from new_backend_ruminate.services.agent.service import AgentService
from new_backend_ruminate.services.document.service import DocumentService
from new_backend_ruminate.services.chunk import ChunkService
from new_backend_ruminate.services.document.text_enhancement_service import TextEnhancementService
from new_backend_ruminate.services.document.ingestion_service import IngestionService
from new_backend_ruminate.context.builder import ContextBuilder
from new_backend_ruminate.context.windowed import WindowedContextBuilder
from new_backend_ruminate.infrastructure.db.bootstrap import get_session as get_db_session
from new_backend_ruminate.context.renderers.agent import register_agent_renderers
from new_backend_ruminate.context.renderers.note_generation import NoteGenerationContext
from new_backend_ruminate.infrastructure.document_processing.llm_document_analyzer import LLMDocumentAnalyzer
from new_backend_ruminate.infrastructure.user.rds_user_repository import RDSUserRepository
from new_backend_ruminate.infrastructure.auth.google_oauth_client import GoogleOAuthClient
from new_backend_ruminate.infrastructure.auth.jwt_manager import JWTManager
from new_backend_ruminate.services.auth.service import AuthService

# New: event publisher abstraction + adapters
from typing import AsyncIterator
from new_backend_ruminate.infrastructure.events.redis_publisher import RedisEventPublisher

class EventPublisher:
    async def publish(self, stream_id: str, chunk: str) -> None:
        raise NotImplementedError

    async def subscribe(self, stream_id: str) -> AsyncIterator[str]:
        raise NotImplementedError

class InProcessEventPublisher(EventPublisher):
    def __init__(self, hub: EventStreamHub) -> None:
        self._hub = hub

    async def publish(self, stream_id: str, chunk: str) -> None:
        await self._hub.publish(stream_id, chunk)

    async def subscribe(self, stream_id: str) -> AsyncIterator[str]:
        async for item in self._hub.register_consumer(stream_id):
            yield item

# New: processing queue singletons
from new_backend_ruminate.infrastructure.queue.inproc_queue import InProcessProcessingQueue
from new_backend_ruminate.infrastructure.queue.redis_queue import RedisProcessingQueue

register_agent_renderers()

# ────────────────────────── singletons ─────────────────────────── #

_hub = EventStreamHub()
# Select event publisher backend
if settings().event_backend == "redis":
    _event_publisher = RedisEventPublisher(url=settings().redis_url)
else:
    _event_publisher = InProcessEventPublisher(_hub)

_repo = RDSConversationRepository()
_document_repo = RDSDocumentRepository()
_user_repo = RDSUserRepository()
_text_enhancement_repo = RDSTextEnhancementRepository()

# Queue selection
if settings().queue_backend == "redis":
    _processing_queue = RedisProcessingQueue(url=settings().redis_url)
else:
    _processing_queue = InProcessProcessingQueue()

if settings().use_responses_api:
    print(f"[Dependencies] Initializing OpenAIResponsesLLM with web_search={settings().enable_web_search}")
    _llm = OpenAIResponsesLLM(
        api_key=settings().openai_api_key,
        model=settings().openai_model,
        enable_web_search=settings().enable_web_search,
    )
else:
    print(f"[Dependencies] Initializing OpenAILLM (standard chat completions)")
    _llm = OpenAILLM(
        api_key=settings().openai_api_key,
        model=settings().openai_model,
    )
_storage = get_object_storage_singleton()
_document_analyzer = LLMDocumentAnalyzer(_llm)
_note_generation_context = NoteGenerationContext()
_chunk_service = ChunkService(_document_repo, _llm)
_ctx_builder = WindowedContextBuilder(_document_repo, chunk_service=_chunk_service)
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
_document_service = DocumentService(
    _document_repo, 
    _hub, 
    _storage,
    llm=_llm,
    analyzer=_document_analyzer if True else None,
    note_context=_note_generation_context,
    conversation_service=_conversation_service,
    chunk_service=_chunk_service,
    processing_queue=_processing_queue,
    event_publisher=_event_publisher,
)
# New: ingestion service singleton
_ingestion_service = IngestionService(
    repo=_document_repo,
    storage=_storage,
    processing_queue=_processing_queue,
    conversation_service=_conversation_service,
)
_text_enhancement_service = TextEnhancementService(_text_enhancement_repo, _llm)
# ─────────────────────── DI provider helpers ───────────────────── #

def get_event_hub() -> EventStreamHub:
    """Return the process-wide in-memory hub (singleton)."""
    return _hub

def get_event_publisher() -> EventPublisher:
    """Return the configured event publisher."""
    return _event_publisher

# New: queue provider

def get_processing_queue():
    return _processing_queue

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

def get_chunk_service() -> ChunkService:
    """Return the singleton ChunkService; stateless, safe to share."""
    return _chunk_service

def get_text_enhancement_service() -> TextEnhancementService:
    """Return the singleton TextEnhancementService; stateless, safe to share."""
    return _text_enhancement_service

def get_auth_service() -> AuthService:
    """Return the singleton AuthService; stateless, safe to share."""
    if _auth_service is None:
        raise HTTPException(status_code=500, detail="Authentication not configured")
    return _auth_service

def get_ingestion_service() -> IngestionService:
    return _ingestion_service

# If you ever need the repository or LLM directly in a router:
def get_conversation_repository() -> RDSConversationRepository:
    return _repo


def get_llm_service() -> OpenAILLM:
    return _llm


def get_storage_service():
    """Return the singleton storage service"""
    return _storage



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
