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
from new_backend_ruminate.config import settings
from new_backend_ruminate.infrastructure.db.bootstrap import init_engine
from new_backend_ruminate.dependencies import get_event_hub  # optional: expose on app.state
from new_backend_ruminate.api.conversation.routes import router as conversation_router
from new_backend_ruminate.api.document.routes import router as document_router
from new_backend_ruminate.api.auth.routes import router as auth_router

app = FastAPI()

app.include_router(conversation_router)          # ← this line wires /conversations/…
app.include_router(document_router)              # ← this line wires /documents/…
app.include_router(auth_router)                  # ← this line wires /auth/…

@app.on_event("startup")
async def _startup() -> None:
    await init_engine(settings())
    app.state.event_hub = get_event_hub()          # handy for websocket upgrades
