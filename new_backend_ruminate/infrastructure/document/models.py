"""SQLAlchemy models for document entities"""
from sqlalchemy import Column, String, Text, JSON, Integer, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from new_backend_ruminate.infrastructure.db.meta import Base
from datetime import datetime


class DocumentModel(Base):
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String, nullable=False, default="PENDING")
    s3_pdf_path = Column(String, nullable=True)
    title = Column(String, nullable=False, default="Untitled Document")
    summary = Column(Text, nullable=True)
    document_info = Column(Text, nullable=True)  # Document-level info from external service
    arguments = Column(JSON, nullable=True)
    key_themes_terms = Column(JSON, nullable=True)
    processing_error = Column(String, nullable=True)
    marker_job_id = Column(String, nullable=True)
    marker_check_url = Column(String, nullable=True)
    # Batch processing fields
    parent_document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    batch_id = Column(String, nullable=True)
    chunk_index = Column(Integer, nullable=True)
    total_chunks = Column(Integer, nullable=True)
    is_auto_processed = Column(Boolean, nullable=False, default=False)
    # Reading progress fields
    furthest_read_block_id = Column(String, nullable=True)
    furthest_read_position = Column(Integer, nullable=True)
    furthest_read_updated_at = Column(DateTime, nullable=True)
    # Main conversation field
    main_conversation_id = Column(String, ForeignKey("conversations.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserModel", back_populates="documents")
    pages = relationship("PageModel", back_populates="document", cascade="all, delete-orphan")
    blocks = relationship("BlockModel", back_populates="document", cascade="all, delete-orphan")
    chunks = relationship("ChunkModel", back_populates="document", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="document", foreign_keys="Conversation.document_id")
    messages = relationship("Message", back_populates="document")
    # Main conversation relationship
    main_conversation = relationship("Conversation", foreign_keys=[main_conversation_id])
    # Batch processing relationships
    parent_document = relationship("DocumentModel", remote_side=[id], backref="child_documents")
    # Text enhancements relationship
    text_enhancements = relationship("TextEnhancementModel", back_populates="document", cascade="all, delete-orphan")


class PageModel(Base):
    __tablename__ = "pages"
    
    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    page_number = Column(Integer, nullable=False)
    polygon = Column(JSON, nullable=True)
    block_ids = Column(JSON, nullable=False, default=list)
    section_hierarchy = Column(JSON, nullable=False, default=dict)
    html_content = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("DocumentModel", back_populates="pages")
    blocks = relationship("BlockModel", back_populates="page")


class ChunkModel(Base):
    __tablename__ = "chunks"
    
    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)  # 0-based position in document
    start_page = Column(Integer, nullable=False)   # inclusive
    end_page = Column(Integer, nullable=False)     # exclusive
    status = Column(String, nullable=False, default="UNPROCESSED")
    summary = Column(Text, nullable=True)
    processing_error = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("DocumentModel", back_populates="chunks")
    blocks = relationship("BlockModel", back_populates="chunk")


class BlockModel(Base):
    __tablename__ = "blocks"
    
    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    page_id = Column(String, ForeignKey("pages.id"), nullable=True)
    chunk_id = Column(String, ForeignKey("chunks.id"), nullable=True)  # Reference to chunk
    block_type = Column(String, nullable=True)
    html_content = Column(Text, nullable=True)
    polygon = Column(JSON, nullable=True)
    page_number = Column(Integer, nullable=True)
    section_hierarchy = Column(JSON, nullable=True)
    meta_data = Column(JSON, nullable=True)
    images = Column(JSON, nullable=True)
    is_critical = Column(Boolean, nullable=True)
    critical_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    document = relationship("DocumentModel", back_populates="blocks")
    page = relationship("PageModel", back_populates="blocks")
    chunk = relationship("ChunkModel", back_populates="blocks")
    messages = relationship("Message", back_populates="block")
    text_enhancements = relationship("TextEnhancementModel", back_populates="block", cascade="all, delete-orphan")