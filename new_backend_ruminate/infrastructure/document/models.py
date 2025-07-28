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
    arguments = Column(JSON, nullable=True)
    key_themes_terms = Column(JSON, nullable=True)
    processing_error = Column(String, nullable=True)
    marker_job_id = Column(String, nullable=True)
    marker_check_url = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserModel", back_populates="documents")
    pages = relationship("PageModel", back_populates="document", cascade="all, delete-orphan")
    blocks = relationship("BlockModel", back_populates="document", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="document")
    messages = relationship("Message", back_populates="document")


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


class BlockModel(Base):
    __tablename__ = "blocks"
    
    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    page_id = Column(String, ForeignKey("pages.id"), nullable=True)
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
    messages = relationship("Message", back_populates="block")