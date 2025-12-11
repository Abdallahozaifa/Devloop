"""Subscription model for Stripe billing."""
import uuid
import enum
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class PlanType(str, enum.Enum):
    """Subscription plan types."""
    FREE = "free"      # Free - 1 project, 5 runs/day (hard limit)
    SOLO = "solo"      # Legacy - kept for DB compatibility
    PRO = "pro"        # $39/mo - 5 projects, 30 runs/day (soft throttle)
    TEAM = "team"      # $79/mo - 15 projects, 50 runs/day (soft throttle)

    def __str__(self):
        return self.value


class SubscriptionStatus(str, enum.Enum):
    """Subscription status from Stripe."""
    ACTIVE = "active"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    INCOMPLETE = "incomplete"
    TRIALING = "trialing"
    UNPAID = "unpaid"

    def __str__(self):
        return self.value


class Subscription(Base):
    """User subscription model."""

    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )

    # Stripe identifiers
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        nullable=True
    )
    stripe_price_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    # Plan info
    plan: Mapped[PlanType] = mapped_column(
        ENUM(
            PlanType,
            name='plantype',
            create_type=True,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=PlanType.FREE,
        nullable=False
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        ENUM(
            SubscriptionStatus,
            name='subscriptionstatus',
            create_type=True,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=SubscriptionStatus.ACTIVE,
        nullable=False
    )

    # Billing period
    current_period_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="subscription")

    @property
    def is_active(self) -> bool:
        """Check if subscription is active."""
        return self.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]

    @property
    def max_projects(self) -> int:
        """Maximum projects allowed for this plan."""
        if self.plan == PlanType.TEAM:
            return 15
        elif self.plan == PlanType.PRO:
            return 5
        elif self.plan == PlanType.SOLO:
            return 5  # Legacy - treat as Pro
        else:  # FREE
            return 1

    @property
    def daily_run_limit(self) -> int:
        """Daily QA run limit for this plan."""
        if self.plan == PlanType.TEAM:
            return 50
        elif self.plan in (PlanType.PRO, PlanType.SOLO):
            return 30
        else:  # FREE
            return 5

    @property
    def is_hard_limit(self) -> bool:
        """Whether the limit is a hard block (True) or soft throttle (False)."""
        return self.plan == PlanType.FREE

    def __repr__(self):
        return f"<Subscription {self.user_id} - {self.plan.value}>"
