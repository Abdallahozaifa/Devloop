"""Project model for user's connected projects."""
import enum
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Enum, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.qa_run import QARun
    from app.models.production_test_run import ProductionTestRun


class QASchedule(str, enum.Enum):
    """Schedule frequency for QA runs."""
    NONE = "none"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"


class Project(Base):
    """Project connected to DevLoop."""

    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(1000),
        nullable=True
    )

    # Project URLs
    api_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    app_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )

    # Stack detection
    stack: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )  # e.g., "fastapi+react", "nextjs", "django+vue"

    # GitHub Integration
    github_repo: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )  # e.g., "owner/repo"
    github_token_encrypted: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )

    # Slack Integration
    slack_webhook_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    slack_notify_on_pass: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    slack_notify_on_fail: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    # Scheduled QA
    qa_schedule: Mapped[QASchedule] = mapped_column(
        Enum(QASchedule, values_callable=lambda x: [e.value for e in x]),
        default=QASchedule.NONE,
        nullable=False
    )
    next_scheduled_run: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Visual Diff / Screenshot Storage
    screenshot_bucket: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )  # S3/R2 bucket name
    baseline_screenshot_prefix: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )  # Prefix for baseline screenshots

    # Production Testing Settings
    production_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )  # Production URL to test (e.g., https://myapp.com)
    production_api_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )  # Production API base URL (e.g., https://api.myapp.com)
    enable_production_testing: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    production_test_schedule: Mapped[QASchedule] = mapped_column(
        Enum(QASchedule, values_callable=lambda x: [e.value for e in x], name='qaschedule', create_constraint=False),
        default=QASchedule.NONE,
        nullable=False
    )
    next_production_test_run: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Health Check Settings
    health_check_endpoint: Mapped[Optional[str]] = mapped_column(
        String(255),
        default="/health",
        nullable=True
    )
    health_check_interval_minutes: Mapped[int] = mapped_column(
        Integer,
        default=5,
        nullable=False
    )
    last_health_check_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    health_check_status: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True
    )  # 'healthy', 'degraded', 'down'

    # Timestamps
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
    last_qa_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="projects")
    qa_runs: Mapped[list["QARun"]] = relationship(
        "QARun",
        back_populates="project",
        order_by="desc(QARun.created_at)"
    )
    production_test_runs: Mapped[list["ProductionTestRun"]] = relationship(
        "ProductionTestRun",
        back_populates="project",
        order_by="desc(ProductionTestRun.created_at)"
    )

    def __repr__(self):
        return f"<Project {self.name}>"
