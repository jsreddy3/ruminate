# models/viewer/page.py
from typing import List, Dict, Optional
from uuid import uuid4
from pydantic import Field
from datetime import datetime
from src.models.base.base_model import BaseModel

class Page(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    document_id: Optional[str] = None
    page_number: Optional[int] = None
    polygon: Optional[List[List[float]]] = None  # Marker uses polygon for dimensions
    block_ids: List[str] = Field(default_factory=list)
    section_hierarchy: Dict[str, str] = Field(default_factory=dict)
    html_content: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def add_block(self, block_id: str) -> None:
        """Add a block ID to this page in reading order"""
        if block_id not in self.block_ids:
            self.block_ids.append(block_id)

    @classmethod
    def from_dict(cls, data: Dict) -> 'Page':
        """Create Page from dictionary"""
        return cls(
            id=data.get('id'),
            document_id=data.get('document_id'),
            page_number=data.get('page_number'),
            polygon=data.get('polygon'),
            block_ids=data.get('block_ids'),
            section_hierarchy=data.get('section_hierarchy'),
            html_content=data.get('html_content')
        )