from typing import Optional, Dict, Any
from uuid import uuid4
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class User:
    """Domain entity for User"""
    id: str = field(default_factory=lambda: str(uuid4()))
    google_id: str = ""
    email: str = ""
    name: str = ""
    avatar_url: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def update_profile(self, name: str, email: str, avatar_url: Optional[str] = None) -> None:
        """Update user profile information"""
        self.name = name
        self.email = email
        if avatar_url:
            self.avatar_url = avatar_url
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "google_id": self.google_id,
            "email": self.email,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        """Create User from dictionary"""
        if data.get('created_at') and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('updated_at') and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        return cls(**data)