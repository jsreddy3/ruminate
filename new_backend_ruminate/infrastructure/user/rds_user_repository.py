from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.domain.user.repositories.user_repository_interface import UserRepositoryInterface
from new_backend_ruminate.infrastructure.user.models import UserModel


class RDSUserRepository(UserRepositoryInterface):
    """RDS implementation of UserRepositoryInterface"""
    
    def _model_to_entity(self, model: UserModel) -> User:
        """Convert UserModel to User entity"""
        return User(
            id=model.id,
            google_id=model.google_id,
            email=model.email,
            name=model.name,
            avatar_url=model.avatar_url,
            has_completed_onboarding=model.has_completed_onboarding,
            created_at=model.created_at,
            updated_at=model.updated_at
        )
    
    def _entity_to_model(self, user: User) -> UserModel:
        """Convert User entity to UserModel"""
        return UserModel(
            id=user.id,
            google_id=user.google_id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            has_completed_onboarding=user.has_completed_onboarding,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    
    async def create_user(self, user: User, session: AsyncSession) -> User:
        """Create a new user"""
        model = self._entity_to_model(user)
        session.add(model)
        await session.flush()
        await session.refresh(model)
        return self._model_to_entity(model)
    
    async def get_user_by_id(self, user_id: str, session: AsyncSession) -> Optional[User]:
        """Get user by ID"""
        stmt = select(UserModel).where(UserModel.id == user_id)
        result = await session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None
    
    async def get_user_by_google_id(self, google_id: str, session: AsyncSession) -> Optional[User]:
        """Get user by Google ID"""
        stmt = select(UserModel).where(UserModel.google_id == google_id)
        result = await session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None
    
    async def get_user_by_email(self, email: str, session: AsyncSession) -> Optional[User]:
        """Get user by email"""
        stmt = select(UserModel).where(UserModel.email == email)
        result = await session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None
    
    async def update_user(self, user: User, session: AsyncSession) -> User:
        """Update an existing user"""
        stmt = select(UserModel).where(UserModel.id == user.id)
        result = await session.execute(stmt)
        model = result.scalar_one()
        
        # Update fields
        model.google_id = user.google_id
        model.email = user.email
        model.name = user.name
        model.avatar_url = user.avatar_url
        model.has_completed_onboarding = user.has_completed_onboarding
        model.updated_at = user.updated_at
        
        await session.flush()
        await session.refresh(model)
        return self._model_to_entity(model)
    
    async def delete_user(self, user_id: str, session: AsyncSession) -> bool:
        """Delete a user by ID"""
        stmt = select(UserModel).where(UserModel.id == user_id)
        result = await session.execute(stmt)
        model = result.scalar_one_or_none()
        
        if model:
            await session.delete(model)
            return True
        return False
    
    async def update_onboarding_status(self, user_id: str, completed: bool, session: AsyncSession) -> None:
        """Update user onboarding completion status"""
        await session.execute(
            update(UserModel)
            .where(UserModel.id == user_id)
            .values(has_completed_onboarding=completed, updated_at=datetime.utcnow())
        )