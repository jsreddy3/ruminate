# new_backend_ruminate/domain/conversation/entities/conversation.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from new_backend_ruminate.infrastructure.db.meta import Base


class ConversationType(str, Enum):
    CHAT = "CHAT"
    AGENT = "AGENT"
    RABBITHOLE = "RABBITHOLE"

class Conversation(Base):
    """
    A single threaded or branching conversation.
    No document, page, or block coupling.
    """

    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("id", name="uq_conversation_id"),)

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    root_message_id: Mapped[Optional[str]] = mapped_column(String)
    active_thread_ids: Mapped[list[str]] = mapped_column(JSON, default=list)

    type: Mapped[ConversationType] = mapped_column(
        SAEnum(ConversationType), default=ConversationType.CHAT, nullable=False
    )
    
    # User relationship
    user_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("users.id"), nullable=True
    )
    
    # Document-related fields
    document_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("documents.id"), nullable=True
    )
    source_block_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    selected_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    text_start_offset: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    text_end_offset: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Relationships
    user = relationship("UserModel", back_populates="conversations")
    document = relationship("DocumentModel", back_populates="conversations", foreign_keys=[document_id])
