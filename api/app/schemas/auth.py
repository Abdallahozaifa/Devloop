"""Auth schemas."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class MagicLinkRequest(BaseModel):
    """Request for magic link login."""
    email: EmailStr


class MagicLinkVerify(BaseModel):
    """Verify magic link token."""
    token: str


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """User profile response."""
    id: UUID
    email: str
    full_name: Optional[str] = None
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True
