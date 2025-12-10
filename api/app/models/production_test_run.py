"""Production Test Run model for tracking production testing history."""
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


class ProductionTestRunStatus(str, enum.Enum):
    """Production test run status."""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"

    def __str__(self):
        return self.value


class ProductionTestRun(Base):
    """Record of a production test run."""

    __tablename__ = "production_test_runs"

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

    status: Mapped[ProductionTestRunStatus] = mapped_column(
        ENUM(
            ProductionTestRunStatus,
            name='productiontestrunstatus',
            create_type=True,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=ProductionTestRunStatus.PENDING,
        nullable=False
    )

    # Run type: smoke, ui, health, full
    run_type: Mapped[str] = mapped_column(
        String(50),
        default="full",
        nullable=False
    )

    # API Test Results
    endpoints_tested: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    endpoints_passed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    endpoints_failed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    # UI Test Results
    ui_tests_passed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    ui_tests_failed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    # Detailed results (JSON)
    api_results: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )  # Array of endpoint test results
    ui_results: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )  # Array of UI test results
    health_results: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )  # Health check details

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

    # Duration in milliseconds
    duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="production_test_runs")

    @property
    def total_endpoints(self) -> int:
        """Total number of endpoints tested."""
        return self.endpoints_passed + self.endpoints_failed

    @property
    def total_ui_tests(self) -> int:
        """Total number of UI tests."""
        return self.ui_tests_passed + self.ui_tests_failed

    @property
    def all_passed(self) -> bool:
        """Check if all tests passed."""
        return self.endpoints_failed == 0 and self.ui_tests_failed == 0

    def __repr__(self):
        return f"<ProductionTestRun {self.id} - {self.status.value}>"
