from typing import List, Dict, Optional, Any, TYPE_CHECKING
from uuid import uuid4
from datetime import datetime
from dataclasses import dataclass, field

if TYPE_CHECKING:
    from new_backend_ruminate.domain.document.entities.block import Block


@dataclass
class Page:
    """Domain entity for document Page"""
    id: str = field(default_factory=lambda: str(uuid4()))
    document_id: str = ""
    page_number: int = 0
    polygon: Optional[List[List[float]]] = None  # Marker uses polygon for dimensions
    block_ids: List[str] = field(default_factory=list)
    section_hierarchy: Dict[str, str] = field(default_factory=dict)
    html_content: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    # Optional preloaded blocks for performance optimization
    blocks: Optional[List['Block']] = field(default=None)

    def add_block(self, block_id: str) -> None:
        """Add a block ID to this page in reading order"""
        if block_id not in self.block_ids:
            self.block_ids.append(block_id)
            self.updated_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "page_number": self.page_number,
            "polygon": self.polygon,
            "block_ids": self.block_ids,
            "section_hierarchy": self.section_hierarchy,
            "html_content": self.html_content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Page':
        """Create Page from dictionary"""
        if data.get('created_at') and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('updated_at') and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        return cls(**data)