# new_backend/domain/models/conversation.py

from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from new_backend_ruminate.infrastructure.db.meta import Base  # a thin `DeclarativeBase` wrapper


class ConversationType(str, Enum):
    DOCUMENT = "document"
    RABBITHOLE = "rabbithole"
    AGENT_RABBITHOLE = "agent_rabbithole"


class Conversation(Base):
    """RDBMS row; no business logic, just persistence."""

    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("id", name="uq_conversation_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    document_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    root_message_id: Mapped[Optional[str]] = mapped_column(String)
    included_pages: Mapped[Dict[str, str]] = mapped_column(JSON, default=dict)
    active_thread_ids: Mapped[list[str]] = mapped_column(JSON, default=list)

    type: Mapped[ConversationType] = mapped_column(SAEnum(ConversationType), default=ConversationType.DOCUMENT)
    source_block_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    selected_text: Mapped[Optional[str]] = mapped_column(Text)
    text_start_offset: Mapped[Optional[int]] = mapped_column(Integer)
    text_end_offset: Mapped[Optional[int]] = mapped_column(Integer)
