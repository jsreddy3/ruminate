from typing import List, Optional, Union
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, computed_field

class AudioSegmentBase(BaseModel):
    filename: str
    duration: float   # seconds
    order: int
    s3_key: str

class AudioSegmentCreate(AudioSegmentBase):
    segment_id: UUID

class AudioSegmentRead(AudioSegmentBase):
    segment_id: UUID = Field(alias="id")
    transcript: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders = {
            datetime: lambda dt: dt.isoformat(timespec="seconds") + "Z"
        }
    )

class DreamBase(BaseModel):
    title: str

class DreamCreate(DreamBase):
    id: UUID | None = None          # accept optional id from client
    title: str

class DreamUpdate(DreamBase):
    pass

class DreamRead(DreamBase):
    id: UUID
    created: datetime
    transcript: Optional[str]
    state: str
    segments: List[AudioSegmentRead] = []
    video_url: Optional[str] = None
    
    @computed_field
    @property
    def videoS3Key(self) -> Optional[str]:
        """Extract S3 key from video_url for iOS compatibility"""
        if self.video_url:
            # Extract key from URL: https://bucket.s3.region.amazonaws.com/dreams/uuid/video.mp4
            return self.video_url.split('.com/')[-1] if '.com/' in self.video_url else None
        return None

    model_config = ConfigDict(
        from_attributes=True,
        json_encoders = {
            datetime: lambda dt: dt.isoformat(timespec="seconds") + "Z"
        }
    )

class TranscriptRead(BaseModel):
    transcript: str

class UploadUrlResponse(BaseModel):
    upload_url: str
    upload_key: str

class VideoCompleteRequest(BaseModel):
    video_url: Optional[str] = None
    metadata: Optional[dict] = None
    status: str  # "completed" or "failed"
    error: Optional[str] = None

class VideoStatusResponse(BaseModel):
    job_id: Optional[str]
    status: Optional[str]
    video_url: Optional[str]

class VideoURLResponse(BaseModel):
    video_url: str
    expires_in: int = 3600  # URL expires in 1 hour by default