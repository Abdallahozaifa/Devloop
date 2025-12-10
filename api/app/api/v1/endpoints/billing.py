"""Billing endpoints for Stripe integration."""
import logging
from typing import Annotated
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.subscription import Subscription, PlanType, SubscriptionStatus
from app.schemas.billing import (
    CreateCheckoutRequest,
    CreateCheckoutResponse,
    CreatePortalRequest,
    CreatePortalResponse,
    SubscriptionResponse,
)
from app.services.stripe_service import StripeService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get current user's subscription details."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        # Return default (no subscription)
        return SubscriptionResponse(
            plan=PlanType.SOLO,
            status=SubscriptionStatus.INCOMPLETE,
            is_active=False,
            max_projects=0,
            cancel_at_period_end=False,
        )

    return SubscriptionResponse(
        plan=subscription.plan,
        status=subscription.status,
        is_active=subscription.is_active,
        max_projects=subscription.max_projects,
        current_period_end=subscription.current_period_end,
        cancel_at_period_end=subscription.cancel_at_period_end,
    )


@router.post("/checkout", response_model=CreateCheckoutResponse)
async def create_checkout_session(
    request: CreateCheckoutRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a Stripe Checkout session for subscription.

    Allows unauthenticated checkout for new users - email is collected by Stripe.
    The webhook will create the user account upon successful payment.
    """
    try:
        checkout_url = await StripeService.create_checkout_session(
            db=db,
            user=None,  # No user yet for new signups
            plan=request.plan,
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            email=request.email,  # Optional email hint for Stripe
        )
        return CreateCheckoutResponse(checkout_url=checkout_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portal", response_model=CreatePortalResponse)
async def create_portal_session(
    request: CreatePortalRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create a Stripe Customer Portal session."""
    try:
        portal_url = await StripeService.create_portal_session(
            db=db,
            user=current_user,
            return_url=request.return_url,
        )
        return CreatePortalResponse(portal_url=portal_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel")
async def cancel_subscription(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Cancel subscription at end of billing period."""
    success = await StripeService.cancel_subscription(db, current_user)
    if not success:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    return {"message": "Subscription will be canceled at end of billing period"}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
):
    """Handle Stripe webhook events."""
    payload = await request.body()
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload,
            stripe_signature,
            webhook_secret,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    event_data = event["data"]["object"]

    logger.info(f"Received Stripe webhook: {event_type}")

    try:
        if event_type == "checkout.session.completed":
            await StripeService.handle_checkout_completed(db, event_data)
        elif event_type == "customer.subscription.updated":
            await StripeService.handle_subscription_updated(db, event_data)
        elif event_type == "customer.subscription.deleted":
            await StripeService.handle_subscription_deleted(db, event_data)
        else:
            logger.info(f"Unhandled webhook event: {event_type}")
    except Exception as e:
        logger.error(f"Error handling webhook: {e}")
        return {"status": "error", "message": str(e)}

    return {"status": "success"}
