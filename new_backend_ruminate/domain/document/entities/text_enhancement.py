from enum import Enum
from typing import Optional, Dict, Any
from uuid import uuid4
from datetime import datetime
from dataclasses import dataclass, field


class TextEnhancementType(str, Enum):
    DEFINITION = "DEFINITION"
    ANNOTATION = "ANNOTATION" 
    RABBITHOLE = "RABBITHOLE"


@dataclass
class TextEnhancement:
    """Unified domain entity for all text enhancements (definitions, annotations, rabbitholes)"""
    id: str = field(default_factory=lambda: str(uuid4()))
    type: TextEnhancementType = TextEnhancementType.DEFINITION
    document_id: str = ""
    block_id: str = ""
    user_id: str = ""
    text: str = ""  # The highlighted text
    text_start_offset: int = 0
    text_end_offset: int = 0
    
    # Type-specific data stored as JSON
    # For DEFINITION: {"term": str, "definition": str, "context": str}
    # For ANNOTATION: {"note": str}
    # For RABBITHOLE: {"conversation_id": str}
    data: Dict[str, Any] = field(default_factory=dict)
    
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "type": self.type.value,
            "document_id": self.document_id,
            "block_id": self.block_id,
            "user_id": self.user_id,
            "text": self.text,
            "text_start_offset": self.text_start_offset,
            "text_end_offset": self.text_end_offset,
            "data": self.data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'TextEnhancement':
        """Create TextEnhancement from dictionary"""
        # Convert type string to enum
        if data.get('type') and isinstance(data['type'], str):
            data['type'] = TextEnhancementType(data['type'])
            
        # Convert datetime strings
        if data.get('created_at') and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('updated_at') and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
            
        return cls(**data)
    
    # Convenience methods for type-specific data
    @property
    def is_definition(self) -> bool:
        return self.type == TextEnhancementType.DEFINITION
    
    @property
    def is_annotation(self) -> bool:
        return self.type == TextEnhancementType.ANNOTATION
    
    @property
    def is_rabbithole(self) -> bool:
        return self.type == TextEnhancementType.RABBITHOLE
    
    def get_term(self) -> Optional[str]:
        """Get term for definitions"""
        return self.data.get("term") if self.is_definition else None
    
    def get_definition(self) -> Optional[str]:
        """Get definition text"""
        return self.data.get("definition") if self.is_definition else None
    
    def get_note(self) -> Optional[str]:
        """Get note for annotations"""
        return self.data.get("note") if self.is_annotation else None
    
    def get_conversation_id(self) -> Optional[str]:
        """Get conversation ID for rabbitholes"""
        return self.data.get("conversation_id") if self.is_rabbithole else None