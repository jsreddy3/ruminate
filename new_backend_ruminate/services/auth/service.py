from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from new_backend_ruminate.domain.user.entities.user import User
from new_backend_ruminate.domain.user.repositories.user_repository_interface import UserRepositoryInterface
from new_backend_ruminate.infrastructure.auth.google_oauth_client import GoogleOAuthClient
from new_backend_ruminate.infrastructure.auth.jwt_manager import JWTManager
from new_backend_ruminate.config import settings


class AuthService:
    """Service for authentication operations"""
    
    def __init__(
        self,
        user_repo: UserRepositoryInterface,
        google_client: GoogleOAuthClient,
        jwt_manager: JWTManager,
    ):
        self._user_repo = user_repo
        self._google_client = google_client
        self._jwt_manager = jwt_manager
    
    def get_google_login_url(self, state: Optional[str] = None) -> str:
        """Get Google OAuth login URL"""
        return self._google_client.get_authorization_url(state)
    
    async def handle_google_callback(self, code: str, session: AsyncSession) -> Tuple[User, str]:
        """Handle Google OAuth callback and return user + JWT token"""
        # Exchange code for token
        token_data = await self._google_client.exchange_code_for_token(code)
        access_token = token_data["access_token"]
        
        # Get user info from Google
        user_info = await self._google_client.get_user_info(access_token)
        
        # Extract user details
        google_id = user_info["id"]
        email = user_info["email"]
        name = user_info["name"]
        avatar_url = user_info.get("picture")
        
        # Find or create user
        existing_user = await self._user_repo.get_user_by_google_id(google_id, session)
        
        if existing_user:
            # Update user profile in case it changed
            existing_user.update_profile(name, email, avatar_url)
            user = await self._user_repo.update_user(existing_user, session)
        else:
            # Create new user
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                avatar_url=avatar_url
            )
            user = await self._user_repo.create_user(user, session)
            
            # Clone template documents for new user
            await self._clone_template_documents(user.id, session)
        
        # Generate JWT token
        jwt_token = self._jwt_manager.create_token(user)
        
        return user, jwt_token
    
    async def validate_token(self, token: str, session: AsyncSession) -> Optional[User]:
        """Validate JWT token and return user if valid"""
        user_id = self._jwt_manager.get_user_id_from_token(token)
        if not user_id:
            return None
        
        user = await self._user_repo.get_user_by_id(user_id, session)
        return user
    
    async def get_user_by_id(self, user_id: str, session: AsyncSession) -> Optional[User]:
        """Get user by ID"""
        return await self._user_repo.get_user_by_id(user_id, session)