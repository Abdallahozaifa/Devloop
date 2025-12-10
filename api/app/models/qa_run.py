"""QA Run model for tracking test history."""
import uuid
import enum
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.project import Project


class QARunStatus(str, enum.Enum):
    """QA run status."""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"

    def __str__(self):
        return self.value


class QARun(Base):
    """Record of a QA test run."""

    __tablename__ = "qa_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )

    status: Mapped[QARunStatus] = mapped_column(
        ENUM(
            QARunStatus,
            name='qarunstatus',
            create_type=True,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=QARunStatus.PENDING,
        nullable=False
    )

    # Run type: smoke, api, ui, all
    run_type: Mapped[str] = mapped_column(
        String(50),
        default="all",
        nullable=False
    )

    # Results
    tests_passed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    tests_failed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    tests_skipped: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    # Detailed results (JSON)
    api_results: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    ui_results: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )

    # Report
    report_markdown: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Error message (if run failed)
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Duration in seconds
    duration_seconds: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="qa_runs")

    @property
    def total_tests(self) -> int:
        """Total number of tests."""
        return self.tests_passed + self.tests_failed + self.tests_skipped

    def __repr__(self):
        return f"<QARun {self.id} - {self.status.value}>"
