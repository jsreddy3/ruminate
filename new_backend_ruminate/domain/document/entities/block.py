from enum import Enum
from typing import Dict, Optional, List, Any
from uuid import uuid4
from datetime import datetime
from dataclasses import dataclass, field


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


@dataclass
class Block:
    """Domain entity for document Block"""
    id: str = field(default_factory=lambda: str(uuid4()))
    document_id: str = ""
    page_id: Optional[str] = None
    chunk_id: Optional[str] = None  # Reference to chunk this block belongs to
    block_type: Optional[BlockType] = None
    html_content: Optional[str] = None
    polygon: Optional[List[List[float]]] = None  # Marker uses polygon
    page_number: Optional[int] = None
    section_hierarchy: Optional[Dict[str, str]] = None
    metadata: Optional[Dict[str, Any]] = None
    images: Optional[Dict[str, str]] = None  # base64 encoded images
    is_critical: Optional[bool] = None
    critical_summary: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @classmethod
    def from_marker_block(cls, 
                         marker_block: Dict[str, Any], 
                         document_id: str, 
                         page_id: str, 
                         page_number: Optional[int] = None) -> 'Block':
        """Create a Block from Marker API response"""
        block_type_str = marker_block.get('block_type')
        if not block_type_str:
            raise ValueError("Block type is required from Marker response")
        
        return cls(
            document_id=document_id,
            page_id=page_id,
            block_type=BlockType(block_type_str),
            html_content=marker_block.get('html'),
            polygon=marker_block.get('polygon'),
            section_hierarchy=marker_block.get('section_hierarchy'),
            metadata=marker_block.get('metadata'),
            images=marker_block.get('images'),
            page_number=page_number,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "page_id": self.page_id,
            "chunk_id": self.chunk_id,
            "block_type": self.block_type.value if self.block_type else None,
            "html_content": self.html_content,
            "polygon": self.polygon,
            "page_number": self.page_number,
            "section_hierarchy": self.section_hierarchy,
            "metadata": self.metadata,
            "images": self.images,
            "is_critical": self.is_critical,
            "critical_summary": self.critical_summary,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Block':
        """Create Block from dictionary"""
        if not data.get('document_id'):
            raise ValueError("document_id is required")
        
        # Convert block_type string to enum
        if data.get('block_type') and isinstance(data['block_type'], str):
            data['block_type'] = BlockType(data['block_type'])
            
        # Convert datetime strings
        if data.get('created_at') and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('updated_at') and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
            
        return cls(**data)