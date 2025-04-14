# src/main.py
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes.document import document_router
from src.api.routes.conversation import router as conversation_router
from src.api.routes.rabbithole import router as rabbithole_router
from src.api.routes.agent import router as agent_router
from src.api.dependencies import initialize_repositories


# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Initialize SSE managers
    from src.services.conversation.agent.sse_manager import SSEManager as AgentSSEManager
    from src.api.sse_manager import STREAMING_QUEUES
    
    # Create singleton instances
    app.state.agent_sse_manager = AgentSSEManager()
    app.state.document_sse_queues = STREAMING_QUEUES
    
    # Initialize repositories
    await initialize_repositories()

app.include_router(document_router)
app.include_router(conversation_router)
app.include_router(rabbithole_router)
app.include_router(agent_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)