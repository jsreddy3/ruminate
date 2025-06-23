from datetime import datetime
from enum import Enum
from uuid import uuid4, UUID as PYUUID
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import (
    Column, DateTime, String, Text
)
from sqlalchemy.orm import relationship
from new_backend_ruminate.infrastructure.db.meta import Base

class DreamStatus(str, Enum):
    PENDING = "pending"
    TRANSCRIBED = "transcribed"
    VIDEO_READY = "video_ready"

class Dream(Base):
    __tablename__ = "dreams"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id    = Column(UUID(as_uuid=True), nullable=True)
    transcript = Column(Text, nullable=True)
    state      = Column(String(20), default=DreamStatus.PENDING.value, nullable=False)
    created    = Column(DateTime, default=datetime.utcnow)
    title      = Column(String(255), nullable=True)

    segments  = relationship(
        "AudioSegment",
        back_populates="dream",
        cascade="all, delete-orphan",
        order_by="AudioSegment.order",
    )