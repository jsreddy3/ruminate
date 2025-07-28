from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class UserResponse(BaseModel):
    """Response schema for user"""
    id: str
    google_id: str
    email: str
    name: str
    avatar_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class LoginResponse(BaseModel):
    """Response schema for login"""
    user: UserResponse
    token: str
    token_type: str = "bearer"


class AuthStatusResponse(BaseModel):
    """Response schema for auth status"""
    authenticated: bool
    user: Optional[UserResponse] = None