# models/viewer/block.py
from enum import Enum
from typing import Dict, Optional, List
from uuid import uuid4
from pydantic import Field
from datetime import datetime
from src.models.base.base_model import BaseModel
from sqlalchemy import Column, String, Text, JSON, Integer, Boolean, ForeignKey
from src.database.base import Base

class BlockType(str, Enum):
    """All possible block types from Marker API"""
    LINE = "Line"
    SPAN = "Span"
    FIGURE_GROUP = "FigureGroup"
    TABLE_GROUP = "TableGroup"
    LIST_GROUP = "ListGroup"
    PICTURE_GROUP = "PictureGroup"
    PAGE = "Page"
    CAPTION = "Caption"
    CODE = "Code"
    FIGURE = "Figure"
    FOOTNOTE = "Footnote"
    FORM = "Form"
    EQUATION = "Equation"
    HANDWRITING = "Handwriting"
    TEXT_INLINE_MATH = "TextInlineMath"
    LIST_ITEM = "ListItem"
    PAGE_FOOTER = "PageFooter"
    PAGE_HEADER = "PageHeader"
    PICTURE = "Picture"
    SECTION_HEADER = "SectionHeader"
    TABLE = "Table"
    TEXT = "Text"
    TABLE_OF_CONTENTS = "TableOfContents"
    DOCUMENT = "Document"
    COMPLEX_REGION = "ComplexRegion"
    TABLE_CELL = "TableCell"
    REFERENCE = "Reference"

class Block(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: str
    page_id: Optional[str] = None
    block_type: Optional[BlockType] = None
    html_content: Optional[str] = None
    polygon: Optional[List[List[float]]] = None  # Marker uses polygon, not x1/y1/x2/y2
    page_number: Optional[int] = None
    section_hierarchy: Optional[Dict[str, str]] = None  # From Marker's section_hierarchy
    metadata: Optional[Dict] = None
    images: Optional[Dict[str, str]] = None  # base64 encoded images
    is_critical: Optional[bool] = None
    critical_summary: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        use_enum_values = True

    @classmethod
    def from_marker_block(cls, marker_block: Dict, document_id: str, page_id: str, page_number: int = None) -> 'Block':
        """Create a Block from Marker API response"""
        assert marker_block.get('block_type', None) is not None, "Block type is None"
        return cls(
            document_id=document_id,
            page_id=page_id,
            block_type=BlockType(marker_block.get('block_type')),
            html_content=marker_block.get('html'),
            polygon=marker_block.get('polygon'),
            section_hierarchy=marker_block.get('section_hierarchy'),
            metadata=marker_block.get('metadata'),
            images=marker_block.get('images'),
            page_number=page_number,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

    @classmethod
    def from_dict(cls, data: Dict) -> 'Block':
        """Create Block from dictionary"""
        if 'document_id' not in data:
            raise ValueError("document_id is required")
            
        block_type = BlockType(data['block_type']) if data.get('block_type') else None
        return cls(
            id=data.get('id'),
            document_id=data['document_id'],
            page_id=data.get('page_id'),
            block_type=block_type,
            html_content=data.get('html_content'),
            polygon=data.get('polygon'),
            page_number=data.get('page_number'),
            section_hierarchy=data.get('section_hierarchy'),
            metadata=data.get('metadata'),
            images=data.get('images'),
            is_critical=data.get('is_critical'),
            critical_summary=data.get('critical_summary')
        )

class BlockModel(Base):
    __tablename__ = "blocks"
    
    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"))
    page_id = Column(String, ForeignKey("pages.id"), nullable=True)
    block_type = Column(String, nullable=True)
    html_content = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    content_type = Column(String, nullable=True)
    polygon = Column(JSON, nullable=True)
    page_number = Column(Integer, nullable=True)
    section_hierarchy = Column(JSON, nullable=True)
    meta_data = Column(JSON, nullable=True)
    images = Column(JSON, nullable=True)
    is_critical = Column(Boolean, nullable=True)
    critical_summary = Column(Text, nullable=True)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)