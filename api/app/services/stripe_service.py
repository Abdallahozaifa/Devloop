"""Stripe service for handling payments and subscriptions."""
import logging
from datetime import datetime
from typing import Optional
import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.models.subscription import Subscription, PlanType, SubscriptionStatus
from app.services.license_service import LicenseService

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    """Service for Stripe operations."""

    PRICE_IDS = {
        PlanType.SOLO: settings.STRIPE_SOLO_PRICE_ID,
        PlanType.PRO: settings.STRIPE_PRO_PRICE_ID,
        PlanType.TEAM: settings.STRIPE_TEAM_PRICE_ID,
    }

    @staticmethod
    def create_customer(user: User) -> str:
        """Create a Stripe customer for a user."""
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name or user.email,
            metadata={"user_id": str(user.id)},
        )
        return customer.id

    @staticmethod
    async def create_checkout_session(
        db: AsyncSession,
        user: Optional[User],
        plan: PlanType,
        success_url: str,
        cancel_url: str,
        email: Optional[str] = None,
    ) -> str:
        """Create a Stripe Checkout session.

        For authenticated users, uses their existing customer ID.
        For unauthenticated users, Stripe collects email and creates customer on checkout.
        """
        # Get price ID for plan
        price_id = StripeService.PRICE_IDS.get(plan)
        if not price_id:
            raise ValueError(f"No price ID configured for plan {plan}")

        checkout_params = {
            "payment_method_types": ["card"],
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": "subscription",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "allow_promotion_codes": True,
            "metadata": {"plan": plan.value},
            "subscription_data": {"metadata": {"plan": plan.value}},
        }

        if user:
            # Authenticated user flow
            logger.info(f"Creating checkout session for user {user.id}, plan {plan}")

            # Get or create subscription record
            result = await db.execute(
                select(Subscription).where(Subscription.user_id == user.id)
            )
            subscription = result.scalar_one_or_none()

            if not subscription:
                subscription = Subscription(user_id=user.id, plan=plan)
                db.add(subscription)
                await db.commit()
                await db.refresh(subscription)

            # Get or create Stripe customer
            if not subscription.stripe_customer_id:
                customer_id = StripeService.create_customer(user)
                subscription.stripe_customer_id = customer_id
                await db.commit()
            else:
                customer_id = subscription.stripe_customer_id

            checkout_params["customer"] = customer_id
            checkout_params["metadata"]["user_id"] = str(user.id)
            checkout_params["subscription_data"]["metadata"]["user_id"] = str(user.id)
        else:
            # Unauthenticated user flow - Stripe collects email
            logger.info(f"Creating checkout session for new user, plan {plan}")
            if email:
                checkout_params["customer_email"] = email

        checkout_session = stripe.checkout.Session.create(**checkout_params)

        logger.info(f"Created checkout session: {checkout_session.id}")
        return checkout_session.url

    @staticmethod
    async def create_portal_session(
        db: AsyncSession,
        user: User,
        return_url: str,
    ) -> str:
        """Create a Stripe Customer Portal session."""
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        subscription = result.scalar_one_or_none()

        if not subscription or not subscription.stripe_customer_id:
            raise ValueError("No subscription found for user")

        portal_session = stripe.billing_portal.Session.create(
            customer=subscription.stripe_customer_id,
            return_url=return_url,
        )

        return portal_session.url

    @staticmethod
    async def handle_checkout_completed(db: AsyncSession, session: dict) -> None:
        """Handle successful checkout session completion.

        For authenticated users: updates their subscription.
        For new users: creates user account, subscription, and license.
        """
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        customer_email = session.get("customer_email") or session.get("customer_details", {}).get("email")
        metadata = session.get("metadata", {})
        user_id = metadata.get("user_id")
        plan_value = metadata.get("plan", "solo")

        logger.info(f"Checkout completed: customer={customer_id}, subscription={subscription_id}, user={user_id}, email={customer_email}")

        # Map plan value to enum
        try:
            plan = PlanType(plan_value)
        except ValueError:
            plan = PlanType.SOLO

        # Get subscription details from Stripe
        current_period_start = None
        current_period_end = None
        if subscription_id:
            try:
                stripe_sub = stripe.Subscription.retrieve(subscription_id)
                current_period_start = datetime.fromtimestamp(stripe_sub.current_period_start)
                current_period_end = datetime.fromtimestamp(stripe_sub.current_period_end)
            except Exception as e:
                logger.error(f"Failed to retrieve Stripe subscription: {e}")

        # Find existing subscription by user_id or customer_id
        subscription = None
        user = None

        if user_id:
            from uuid import UUID
            result = await db.execute(
                select(Subscription).where(Subscription.user_id == UUID(user_id))
            )
            subscription = result.scalar_one_or_none()
            if subscription:
                result = await db.execute(select(User).where(User.id == UUID(user_id)))
                user = result.scalar_one_or_none()

        if not subscription and customer_id:
            result = await db.execute(
                select(Subscription).where(Subscription.stripe_customer_id == customer_id)
            )
            subscription = result.scalar_one_or_none()
            if subscription:
                result = await db.execute(select(User).where(User.id == subscription.user_id))
                user = result.scalar_one_or_none()

        # If no existing subscription and we have an email, create new user
        if not subscription and customer_email:
            # Check if user with this email already exists
            result = await db.execute(select(User).where(User.email == customer_email))
            user = result.scalar_one_or_none()

            if not user:
                # Create new user
                user = User(email=customer_email)
                db.add(user)
                await db.commit()
                await db.refresh(user)
                logger.info(f"Created new user {user.id} for email {customer_email}")

            # Create subscription for user
            subscription = Subscription(
                user_id=user.id,
                stripe_subscription_id=subscription_id,
                stripe_customer_id=customer_id,
                plan=plan,
                status=SubscriptionStatus.ACTIVE,
                current_period_start=current_period_start,
                current_period_end=current_period_end,
                cancel_at_period_end=False,
            )
            db.add(subscription)
            await db.commit()
            await db.refresh(subscription)
            logger.info(f"Created subscription for user {user.id}")

        elif subscription:
            # Update existing subscription
            subscription.stripe_subscription_id = subscription_id
            subscription.stripe_customer_id = customer_id
            subscription.plan = plan
            subscription.status = SubscriptionStatus.ACTIVE
            if current_period_start:
                subscription.current_period_start = current_period_start
            if current_period_end:
                subscription.current_period_end = current_period_end
            subscription.cancel_at_period_end = False
            await db.commit()
            await db.refresh(subscription)
            logger.info(f"Updated subscription for user {subscription.user_id}")

        # Generate license key for the user
        if user:
            await LicenseService.generate_license(db, user)
            logger.info(f"Generated license for user {user.id}")

            # Send magic link email so user can access dashboard
            from app.services.email_service import EmailService
            try:
                await EmailService.send_magic_link(db, user.email)
                logger.info(f"Sent magic link to {user.email}")
            except Exception as e:
                logger.error(f"Failed to send magic link: {e}")

    @staticmethod
    async def handle_subscription_updated(db: AsyncSession, stripe_sub: dict) -> None:
        """Handle subscription update from Stripe webhook."""
        subscription_id = stripe_sub.get("id")
        customer_id = stripe_sub.get("customer")
        status = stripe_sub.get("status")

        result = await db.execute(
            select(Subscription).where(
                (Subscription.stripe_subscription_id == subscription_id) |
                (Subscription.stripe_customer_id == customer_id)
            )
        )
        subscription = result.scalar_one_or_none()

        if not subscription:
            return

        subscription.stripe_subscription_id = subscription_id

        # Map status
        try:
            subscription.status = SubscriptionStatus(status)
        except ValueError:
            subscription.status = SubscriptionStatus.ACTIVE

        # Update period
        if stripe_sub.get("current_period_start"):
            subscription.current_period_start = datetime.fromtimestamp(
                stripe_sub["current_period_start"]
            )
        if stripe_sub.get("current_period_end"):
            subscription.current_period_end = datetime.fromtimestamp(
                stripe_sub["current_period_end"]
            )

        subscription.cancel_at_period_end = stripe_sub.get("cancel_at_period_end", False)

        await db.commit()

    @staticmethod
    async def handle_subscription_deleted(db: AsyncSession, stripe_sub: dict) -> None:
        """Handle subscription cancellation/deletion."""
        subscription_id = stripe_sub.get("id")

        result = await db.execute(
            select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
        )
        subscription = result.scalar_one_or_none()

        if subscription:
            subscription.status = SubscriptionStatus.CANCELED
            subscription.stripe_subscription_id = None

            # Revoke license after 7-day grace period
            # For now, just mark as canceled - a scheduled job can revoke later
            await db.commit()
            logger.info(f"Marked subscription as canceled for user {subscription.user_id}")

    @staticmethod
    async def cancel_subscription(db: AsyncSession, user: User) -> bool:
        """Cancel a user's subscription at period end."""
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        subscription = result.scalar_one_or_none()

        if not subscription or not subscription.stripe_subscription_id:
            return False

        stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            cancel_at_period_end=True
        )

        subscription.cancel_at_period_end = True
        await db.commit()

        return True
