from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SAEnum, JSON, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from new_backend_ruminate.infrastructure.db.meta import Base
from new_backend_ruminate.domain.document.entities.text_enhancement import TextEnhancementType


class TextEnhancementModel(Base):
    """Infrastructure model for text enhancements table"""
    __tablename__ = "text_enhancements"
    
    # Core fields
    id = Column(String, primary_key=True)
    type = Column(SAEnum(TextEnhancementType), nullable=False)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    block_id = Column(String, ForeignKey("blocks.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Text and position
    text = Column(String, nullable=False)  # The highlighted text
    text_start_offset = Column(Integer, nullable=False)
    text_end_offset = Column(Integer, nullable=False)
    
    # Type-specific data
    data = Column(JSON, nullable=False, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("DocumentModel", back_populates="text_enhancements")
    block = relationship("BlockModel", back_populates="text_enhancements")
    user = relationship("UserModel", back_populates="text_enhancements")
    
    # Indexes for performance
    __table_args__ = (
        # Fast lookup by document
        Index("idx_text_enhancement_document", "document_id"),
        # Fast lookup by block
        Index("idx_text_enhancement_block", "block_id"),
        # Fast lookup by user
        Index("idx_text_enhancement_user", "user_id"),
        # Fast lookup by type and document
        Index("idx_text_enhancement_type_document", "type", "document_id"),
        # Prevent duplicate enhancements at same position
        UniqueConstraint("block_id", "text_start_offset", "text_end_offset", "type", 
                        name="uq_text_enhancement_position"),
    )