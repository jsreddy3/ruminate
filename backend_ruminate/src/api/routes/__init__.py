from fastapi import APIRouter
from .document import document_router

router = APIRouter()
router.include_router(document_router)

@router.get("/health")
async def health_check():
    return {"status": "healthy"}