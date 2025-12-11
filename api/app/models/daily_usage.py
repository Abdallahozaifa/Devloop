"""Daily usage tracking model for throttling."""
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING
from sqlalchemy import Date, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class DailyUsage(Base):
    """Track daily QA run usage per user for throttling."""

    __tablename__ = "daily_usage"
    __table_args__ = (
        UniqueConstraint('user_id', 'usage_date', name='uq_user_date'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    usage_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True
    )
    runs_used: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    throttle_hits: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="daily_usage")

    def __repr__(self):
        return f"<DailyUsage {self.user_id} - {self.usage_date} - {self.runs_used} runs>"
