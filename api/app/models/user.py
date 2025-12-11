"""User model."""
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.subscription import Subscription
    from app.models.license import License
    from app.models.project import Project
    from app.models.daily_usage import DailyUsage


class User(Base):
    """User model for authentication and profile."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
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
    subscription: Mapped[Optional["Subscription"]] = relationship(
        "Subscription",
        back_populates="user",
        uselist=False
    )
    licenses: Mapped[list["License"]] = relationship(
        "License",
        back_populates="user"
    )
    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="user"
    )
    daily_usage: Mapped[list["DailyUsage"]] = relationship(
        "DailyUsage",
        back_populates="user"
    )

    def __repr__(self):
        return f"<User {self.email}>"
