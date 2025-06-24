# new_backend_ruminate/api/dream/routes.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from fastapi.responses import StreamingResponse

from new_backend_ruminate.infrastructure.sse.hub import EventStreamHub
from new_backend_ruminate.services.dream.service import DreamService
from new_backend_ruminate.domain.object_storage.repo import ObjectStorageRepository
from new_backend_ruminate.dependencies import (
    get_session,
    get_event_hub,
    get_dream_service,
    get_storage_service,
)
from .schemas import (
    DreamCreate, DreamUpdate, DreamRead,
    AudioSegmentCreate, AudioSegmentRead, TranscriptRead,
    UploadUrlResponse,
)

router = APIRouter(prefix="/dreams", tags=["dreams"])

# ─────────────────────────────── dreams ─────────────────────────────── #

@router.get("/", response_model=list[DreamRead], name="list_dreams")
async def list_dreams(
    svc: DreamService = Depends(get_dream_service),
    db: AsyncSession = Depends(get_session),
):
    return await svc.list_dreams(db)

@router.post("/", response_model=DreamRead, status_code=status.HTTP_201_CREATED)
async def create_dream(
    payload: DreamCreate,
    svc: DreamService = Depends(get_dream_service),
    db: AsyncSession = Depends(get_session),
):
    return await svc.create_dream(payload, db)

@router.get("/{did}", response_model=DreamRead)
async def read_dream(
    did: UUID,
    svc: DreamService = Depends(get_dream_service),
    db: AsyncSession = Depends(get_session),
):
    dream = await svc.get_dream(did, db)
    if not dream:
        raise HTTPException(404, "Dream not found")
    return dream

@router.patch("/{did}", response_model=DreamRead)
async def update_title(
    did: UUID,
    patch: DreamUpdate,
    svc: DreamService = Depends(get_dream_service),
    db: AsyncSession = Depends(get_session),
):
    dream = await svc.update_title(did, patch.title, db)
    if not dream:
        raise HTTPException(404, "Dream not found")
    return dream

@router.get("/{did}/transcript", response_model=TranscriptRead)
async def get_transcript(
    did: UUID,
    svc: DreamService = Depends(get_dream_service),
    db: AsyncSession = Depends(get_session),
):
    txt = await svc.get_transcript(did, db)
    if txt is None:
        raise HTTPException(404, "Dream not found")
    return TranscriptRead(transcript=txt)

# ───────────────────────────── segments ─────────────────────────────── #

@router.post("/{did}/segments", response_model=AudioSegmentRead)
async def add_segment(
    did: UUID,
    seg: AudioSegmentCreate,
    tasks: BackgroundTasks,
    svc: DreamService = Depends(get_dream_service),
    db: AsyncSession   = Depends(get_session),
):
    segment = await svc.add_segment(did, seg, db)
    # queue background Deepgram transcription
    tasks.add_task(svc.transcribe_segment_and_store, did, segment.id, seg.filename)
    print(f"Returning segment with transcript: {segment.transcript} and id {segment.id}")
    return segment

@router.delete("/{did}/segments/{sid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_segment(
    did: UUID, sid: UUID,
    svc: DreamService  = Depends(get_dream_service),
    db: AsyncSession   = Depends(get_session),
):
    ok = await svc.delete_segment(did, sid, db)
    if not ok:
        raise HTTPException(404, "Segment not found")

@router.get("/{did}/segments", response_model=list[AudioSegmentRead])
async def list_segments(
    did: UUID,
    svc: DreamService = Depends(get_dream_service),
    db: AsyncSession   = Depends(get_session),
):
    dream = await svc.get_dream(did, db)
    if not dream:
        raise HTTPException(404, "Dream not found")
    return dream.segments

# --------------------------- dream stream ------------------------------ #

@router.get("/{did}/stream")
async def stream(did: UUID, hub: EventStreamHub = Depends(get_event_hub)):
    async def event_source():
        async for chunk in hub.register_consumer(did):
            yield f"data: {chunk}\n\n"
    return StreamingResponse(event_source(), media_type="text/event-stream")

# ─────────────────────────── presigned URL ─────────────────────────── #

@router.post("/{did}/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    did: UUID,
    filename: str,
    storage: ObjectStorageRepository = Depends(get_storage_service),
):
    key, url = await storage.generate_presigned_put(did, filename)
    print(f"Generated upload URL {url} with key {key}")
    return UploadUrlResponse(upload_url=url, upload_key=key)

# ─────────────────────── finish & video complete ────────────────────── #

@router.post("/{did}/finish")
async def finish_dream(did: UUID, svc: DreamService = Depends(get_dream_service)):
    await svc.finish_dream(did)
    return {"status": "video_queued"}

@router.post("/{did}/video-complete")
async def video_complete(did: UUID, svc: DreamService = Depends(get_dream_service)):
    await svc.mark_video_complete(did)
    return {"status": "ok"}