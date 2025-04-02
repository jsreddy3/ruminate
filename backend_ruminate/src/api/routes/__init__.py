from fastapi import APIRouter
from .document import document_router
from .graph import graph_router
from .tools import router as tools_router

router = APIRouter()
router.include_router(document_router)
router.include_router(graph_router)
router.include_router(tools_router)

@router.get("/health")
async def health_check():
    return {"status": "healthy"}