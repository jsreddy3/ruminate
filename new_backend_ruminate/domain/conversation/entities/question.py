# new_backend_ruminate/domain/conversation/entities/question.py
from __future__ import annotations

from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from new_backend_ruminate.infrastructure.db.meta import Base


class ConversationQuestion(Base):
    """
    Auto-generated questions for conversations based on document context.
    Questions are generated when a conversation is created and help users
    discover relevant topics to explore.
    """

    __tablename__ = "conversation_questions"
    __table_args__ = (
        UniqueConstraint("id", name="uq_conversation_question_id"),
        Index("ix_conversation_questions_conv_id", "conversation_id"),
        Index("ix_conversation_questions_created", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    
    # Link to conversation
    conversation_id: Mapped[str] = mapped_column(
        String, ForeignKey("conversations.id"), nullable=False
    )
    
    # Question content
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Context information
    source_page_numbers: Mapped[Optional[List[int]]] = mapped_column(JSON)  # Pages used to generate question
    source_block_ids: Mapped[Optional[List[str]]] = mapped_column(JSON)     # Block IDs used as context
    
    # Display ordering
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Track if question has been used
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Metadata
    generation_context: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)  # Context used for generation
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    
    # Relationships
    conversation = relationship("Conversation")