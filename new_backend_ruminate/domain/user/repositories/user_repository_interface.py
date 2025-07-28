from abc import ABC, abstractmethod
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from new_backend_ruminate.domain.user.entities.user import User


class UserRepositoryInterface(ABC):
    """Interface for user repository operations"""
    
    @abstractmethod
    async def create_user(self, user: User, session: AsyncSession) -> User:
        """Create a new user"""
        pass
    
    @abstractmethod
    async def get_user_by_id(self, user_id: str, session: AsyncSession) -> Optional[User]:
        """Get user by ID"""
        pass
    
    @abstractmethod
    async def get_user_by_google_id(self, google_id: str, session: AsyncSession) -> Optional[User]:
        """Get user by Google ID"""
        pass
    
    @abstractmethod
    async def get_user_by_email(self, email: str, session: AsyncSession) -> Optional[User]:
        """Get user by email"""
        pass
    
    @abstractmethod
    async def update_user(self, user: User, session: AsyncSession) -> User:
        """Update an existing user"""
        pass
    
    @abstractmethod
    async def delete_user(self, user_id: str, session: AsyncSession) -> bool:
        """Delete a user by ID"""
        pass