import jwt
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from new_backend_ruminate.domain.user.entities.user import User


class JWTManager:
    """Manager for JWT token creation and validation"""
    
    def __init__(self, secret_key: str, algorithm: str = "HS256", expire_hours: int = 24):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.expire_hours = expire_hours
    
    def create_token(self, user: User) -> str:
        """Create JWT token for user"""
        now = datetime.utcnow()
        payload = {
            "sub": user.id,  # subject (user ID)
            "google_id": user.google_id,
            "email": user.email,
            "name": user.name,
            "iat": now,  # issued at
            "exp": now + timedelta(hours=self.expire_hours),  # expiration
        }
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def get_user_id_from_token(self, token: str) -> Optional[str]:
        """Extract user ID from JWT token"""
        payload = self.decode_token(token)
        return payload.get("sub") if payload else None
    
    def is_token_valid(self, token: str) -> bool:
        """Check if token is valid (not expired and properly signed)"""
        return self.decode_token(token) is not None