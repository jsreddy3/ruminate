# src/main.py
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes.document import document_router
from src.api.routes.conversation import router as conversation_router
from src.api.dependencies import initialize_repositories
from src.api.routes.insights import router as insights_router
from src.api.routes.graph import graph_router
from src.api.routes.tools import router as tools_router


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
    await initialize_repositories()

app.include_router(document_router)
app.include_router(conversation_router)
app.include_router(insights_router)
app.include_router(graph_router)
app.include_router(tools_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)