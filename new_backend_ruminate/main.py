# new_backend_ruminate/main.py

# Load environment variables first, before importing anything else
from dotenv import load_dotenv
from pathlib import Path

# Load .env files in order of precedence
current_dir = Path(__file__).parent.absolute()
parent_dir = current_dir.parent

env_files = [
    current_dir / ".env",  # new_backend_ruminate/.env (highest precedence)
    parent_dir / ".env",   # ruminate/.env
]

for env_file in env_files:
    if env_file.exists():
        load_dotenv(env_file, override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from new_backend_ruminate.config import settings
from new_backend_ruminate.infrastructure.db.bootstrap import init_engine
from new_backend_ruminate.dependencies import get_event_hub  # optional: expose on app.state
from new_backend_ruminate.api.conversation.routes import router as conversation_router
from new_backend_ruminate.api.document.routes import router as document_router
from new_backend_ruminate.api.auth.routes import router as auth_router
from new_backend_ruminate.middleware.security import (
    SecurityHeadersMiddleware, 
    RateLimitMiddleware,
    FileUploadSecurityMiddleware
)

app = FastAPI()

# Add security middleware (order matters - add from innermost to outermost)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)  # Allow 120 requests per minute
app.add_middleware(FileUploadSecurityMiddleware, max_file_size=100 * 1024 * 1024)  # 100MB limit

# Add CORS middleware (should be last/outermost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "http://localhost:3001",  # Local development
        "https://ruminate-six.vercel.app",  # Production frontend
        "https://tryruminate.com"  # New production domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversation_router)          # ← this line wires /conversations/…
app.include_router(document_router)              # ← this line wires /documents/…
app.include_router(auth_router)                  # ← this line wires /auth/…

@app.get("/health")
async def health_check():
    """Health check endpoint for Fly.io monitoring"""
    return {"status": "healthy", "service": "ruminate-backend"}

@app.on_event("startup")
async def _startup() -> None:
    await init_engine(settings())
    app.state.event_hub = get_event_hub()          # handy for websocket upgrades
