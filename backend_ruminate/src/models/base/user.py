# models/base/user.py
from typing import Optional
from datetime import datetime
from pydantic import Field
from src.models.base.base_model import BaseModel
from uuid import uuid4

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    username: str
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    last_active: datetime = Field(default_factory=datetime.now)
    
    def update_activity(self) -> None:
        """Update the user's last activity timestamp"""
        self.last_active = datetime.now()
    
    @classmethod
    def get_test_user(cls, username: str = "test_user") -> "User":
        """Create a test user with a fixed ID for testing purposes"""
        return cls(
            id=f"test_{username}_id",
            username=username,
            email=f"{username}@test.com"
        )
