from typing import Optional
import urllib.parse
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from new_backend_ruminate.api.auth.schemas import LoginResponse, AuthStatusResponse, UserResponse
from new_backend_ruminate.services.auth.service import AuthService
from new_backend_ruminate.dependencies import get_session, get_auth_service, get_current_user_optional, get_current_user
from new_backend_ruminate.domain.user.entities.user import User

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/login")
async def login(
    redirect_url: Optional[str] = Query("http://localhost:3000", description="URL to redirect to after login"),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Redirect to Google OAuth login page
    """
    google_login_url = auth_service.get_google_login_url(state=redirect_url)
    return RedirectResponse(url=google_login_url)


@router.get("/callback")
async def callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: Optional[str] = Query(None, description="State parameter (redirect URL)"),
    session: AsyncSession = Depends(get_session),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Handle Google OAuth callback
    """
    try:
        user, token = await auth_service.handle_google_callback(code, session)
        await session.commit()
        
        # Redirect back to frontend with token and user data
        frontend_url = state or "http://localhost:3000"
        
        # URL encode the user data
        user_data = {
            "id": user.id,
            "google_id": user.google_id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url,
            "has_completed_onboarding": user.has_completed_onboarding,
            "created_at": user.created_at.isoformat(),
            "updated_at": user.updated_at.isoformat()
        }
        user_param = urllib.parse.quote(json.dumps(user_data))
        
        redirect_url = f"{frontend_url}?token={token}&user={user_param}"
        return RedirectResponse(url=redirect_url)
        
    except Exception as e:
        await session.rollback()
        # Redirect to frontend with error
        frontend_url = state or "http://localhost:3000"
        error_url = f"{frontend_url}?error={urllib.parse.quote(str(e))}"
        return RedirectResponse(url=error_url)


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: User = Depends(get_current_user_optional),
):
    """
    Get current authenticated user
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return UserResponse(
        id=current_user.id,
        google_id=current_user.google_id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        has_completed_onboarding=current_user.has_completed_onboarding,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )


@router.get("/status", response_model=AuthStatusResponse)
async def get_auth_status(
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Check authentication status
    """
    if current_user:
        user_response = UserResponse(
            id=current_user.id,
            google_id=current_user.google_id,
            email=current_user.email,
            name=current_user.name,
            avatar_url=current_user.avatar_url,
            has_completed_onboarding=current_user.has_completed_onboarding,
            created_at=current_user.created_at,
            updated_at=current_user.updated_at
        )
        return AuthStatusResponse(authenticated=True, user=user_response)
    else:
        return AuthStatusResponse(authenticated=False)


@router.post("/logout")
async def logout():
    """
    Logout (client should delete token)
    """
    return {"message": "Logged out successfully. Please delete your token on the client side."}


@router.patch("/onboarding/complete")
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Mark user onboarding as complete
    """
    await auth_service.complete_onboarding(current_user.id, session)
    await session.commit()
    
    return {"message": "Onboarding completed successfully"}