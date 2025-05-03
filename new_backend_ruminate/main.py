# new_backend_ruminate/main.py

from fastapi import FastAPI
from new_backend_ruminate.config import settings
from new_backend_ruminate.infrastructure.db.bootstrap import init_engine
from new_backend_ruminate.dependencies import get_event_hub  # optional: expose on app.state
from new_backend_ruminate.api.routes.conversation import router as conversation_router

app = FastAPI()

app.include_router(conversation_router)          # ← this line wires /conversations/…

@app.on_event("startup")
async def _startup() -> None:
    await init_engine(settings())
    app.state.event_hub = get_event_hub()          # handy for websocket upgrades
