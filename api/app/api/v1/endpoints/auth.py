"""Authentication endpoints with magic link login."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_magic_link_token, verify_magic_link_token, create_access_token
from app.api.deps import get_current_user
from app.models.user import User
from app.models.subscription import Subscription, PlanType, SubscriptionStatus
from app.schemas.auth import MagicLinkRequest, MagicLinkVerify, TokenResponse, UserResponse
from app.services.email_service import EmailService

router = APIRouter()


@router.post("/magic-link")
async def send_magic_link(
    request: MagicLinkRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a magic link login email."""
    email = request.email.lower()

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(email=email, is_verified=False)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Generate and send magic link
    token = create_magic_link_token(email)
    EmailService.send_magic_link(email, token)

    return {"message": "Magic link sent to your email"}


@router.post("/verify", response_model=TokenResponse)
async def verify_magic_link(
    request: MagicLinkVerify,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Verify magic link and return JWT token."""
    email = verify_magic_link_token(request.token)

    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired magic link")

    # Find user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if user has a subscription, create free one if needed
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    existing_sub = sub_result.scalar_one_or_none()

    # Create free subscription for users without one
    if not existing_sub:
        subscription = Subscription(
            user_id=user.id,
            plan=PlanType.FREE,
            status=SubscriptionStatus.ACTIVE,
        )
        db.add(subscription)

    # Mark as verified if first time
    if not user.is_verified:
        user.is_verified = True

    await db.commit()

    # Generate JWT
    access_token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get current user profile."""
    return current_user
