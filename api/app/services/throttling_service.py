"""Throttling service for rate limiting QA runs."""
import asyncio
import logging
from datetime import date, datetime, timezone
from typing import NamedTuple, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.subscription import Subscription, PlanType
from app.models.daily_usage import DailyUsage

logger = logging.getLogger(__name__)


class ThrottleResult(NamedTuple):
    """Result of a throttle check."""
    allowed: bool
    runs_used: int
    runs_limit: int
    is_hard_limit: bool
    delay_seconds: int  # Delay to apply if throttled (for soft limits)
    message: str


class ThrottlingService:
    """Service for managing QA run throttling based on subscription limits."""

    # Throttle delays in seconds (progressive for soft limits)
    SOFT_THROTTLE_DELAYS = [0, 0, 0, 30, 60, 120, 300, 600]  # After 3rd over-limit run

    @staticmethod
    async def get_daily_usage(
        db: AsyncSession,
        user_id: UUID,
        usage_date: Optional[date] = None
    ) -> DailyUsage:
        """Get or create daily usage record for a user."""
        if usage_date is None:
            usage_date = datetime.now(timezone.utc).date()

        result = await db.execute(
            select(DailyUsage).where(
                DailyUsage.user_id == user_id,
                DailyUsage.usage_date == usage_date
            )
        )
        usage = result.scalar_one_or_none()

        if not usage:
            usage = DailyUsage(
                user_id=user_id,
                usage_date=usage_date,
                runs_used=0,
                throttle_hits=0
            )
            db.add(usage)
            await db.commit()
            await db.refresh(usage)

        return usage

    @staticmethod
    async def check_throttle(
        db: AsyncSession,
        user: User
    ) -> ThrottleResult:
        """
        Check if a user can run a QA test.

        Returns ThrottleResult with:
        - allowed: True if the run is allowed
        - delay_seconds: How many seconds to delay if soft throttled
        - message: Human-readable status message
        """
        # Get subscription
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        subscription = result.scalar_one_or_none()

        # Default to FREE plan if no subscription
        if not subscription:
            subscription = Subscription(user_id=user.id, plan=PlanType.FREE)

        daily_limit = subscription.daily_run_limit
        is_hard = subscription.is_hard_limit

        # Get today's usage
        usage = await ThrottlingService.get_daily_usage(db, user.id)
        runs_used = usage.runs_used

        # Check if under limit
        if runs_used < daily_limit:
            return ThrottleResult(
                allowed=True,
                runs_used=runs_used,
                runs_limit=daily_limit,
                is_hard_limit=is_hard,
                delay_seconds=0,
                message=f"Run {runs_used + 1} of {daily_limit} today"
            )

        # Over limit - check if hard or soft
        if is_hard:
            return ThrottleResult(
                allowed=False,
                runs_used=runs_used,
                runs_limit=daily_limit,
                is_hard_limit=True,
                delay_seconds=0,
                message=f"Daily limit of {daily_limit} runs reached. Upgrade for more runs."
            )

        # Soft limit - calculate delay
        over_count = runs_used - daily_limit
        delay_index = min(over_count, len(ThrottlingService.SOFT_THROTTLE_DELAYS) - 1)
        delay = ThrottlingService.SOFT_THROTTLE_DELAYS[delay_index]

        # Record throttle hit
        usage.throttle_hits += 1
        await db.commit()

        return ThrottleResult(
            allowed=True,
            runs_used=runs_used,
            runs_limit=daily_limit,
            is_hard_limit=False,
            delay_seconds=delay,
            message=f"Soft limit reached ({runs_used}/{daily_limit}). {delay}s delay applied." if delay > 0
                    else f"Over daily limit ({runs_used}/{daily_limit})"
        )

    @staticmethod
    async def record_run(
        db: AsyncSession,
        user_id: UUID
    ) -> DailyUsage:
        """Record a QA run for throttling purposes."""
        usage = await ThrottlingService.get_daily_usage(db, user_id)
        usage.runs_used += 1
        usage.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(usage)
        logger.info(f"Recorded run for user {user_id}: {usage.runs_used} runs today")
        return usage

    @staticmethod
    async def apply_throttle_delay(delay_seconds: int) -> None:
        """Apply throttle delay if needed."""
        if delay_seconds > 0:
            logger.info(f"Applying throttle delay of {delay_seconds} seconds")
            await asyncio.sleep(delay_seconds)

    @staticmethod
    async def get_usage_stats(
        db: AsyncSession,
        user: User
    ) -> dict:
        """Get usage statistics for dashboard display."""
        # Get subscription
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        subscription = result.scalar_one_or_none()

        if not subscription:
            subscription = Subscription(user_id=user.id, plan=PlanType.FREE)

        # Get today's usage
        usage = await ThrottlingService.get_daily_usage(db, user.id)

        daily_limit = subscription.daily_run_limit
        runs_used = usage.runs_used
        runs_remaining = max(0, daily_limit - runs_used)

        return {
            "plan": subscription.plan.value,
            "daily_limit": daily_limit,
            "runs_used": runs_used,
            "runs_remaining": runs_remaining,
            "is_hard_limit": subscription.is_hard_limit,
            "throttle_hits": usage.throttle_hits,
            "reset_time": "midnight UTC",
            "over_limit": runs_used >= daily_limit,
            "percentage_used": min(100, int((runs_used / daily_limit) * 100)) if daily_limit > 0 else 0
        }
