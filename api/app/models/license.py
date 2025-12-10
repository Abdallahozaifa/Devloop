"""License model for CLI activation."""
import uuid
import enum
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class LicenseStatus(str, enum.Enum):
    """License status."""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"

    def __str__(self):
        return self.value


class License(Base):
    """License key for CLI activation."""

    __tablename__ = "licenses"

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

    # License key: DL-XXXX-XXXX-XXXX
    key: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=False
    )

    # Signature for verification
    signature: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )

    status: Mapped[LicenseStatus] = mapped_column(
        ENUM(
            LicenseStatus,
            name='licensestatus',
            create_type=True,
            values_callable=lambda x: [e.value for e in x]
        ),
        default=LicenseStatus.ACTIVE,
        nullable=False
    )

    # Machine/device info (optional)
    machine_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="licenses")

    @property
    def is_valid(self) -> bool:
        """Check if license is valid."""
        if self.status != LicenseStatus.ACTIVE:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def __repr__(self):
        return f"<License {self.key} - {self.status.value}>"
