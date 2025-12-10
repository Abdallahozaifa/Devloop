"""Billing schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.models.subscription import PlanType, SubscriptionStatus


class CreateCheckoutRequest(BaseModel):
    """Request to create Stripe checkout session."""
    plan: PlanType
    email: Optional[str] = None  # For unauthenticated checkout
    success_url: str = "https://devloop-landing.fly.dev/checkout/success"
    cancel_url: str = "https://devloop-landing.fly.dev/#pricing"


class CreateCheckoutResponse(BaseModel):
    """Checkout session response."""
    checkout_url: str


class CreatePortalRequest(BaseModel):
    """Request to create Stripe customer portal."""
    return_url: str


class CreatePortalResponse(BaseModel):
    """Customer portal response."""
    portal_url: str


class SubscriptionResponse(BaseModel):
    """Subscription details."""
    plan: PlanType
    status: SubscriptionStatus
    is_active: bool
    max_projects: int
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False

    class Config:
        from_attributes = True
