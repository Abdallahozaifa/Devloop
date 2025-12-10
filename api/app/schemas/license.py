"""License schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.models.license import LicenseStatus


class LicenseResponse(BaseModel):
    """License details."""
    key: str
    status: LicenseStatus
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VerifyLicenseRequest(BaseModel):
    """Request to verify a license key."""
    license_key: str
    machine_id: Optional[str] = None


class VerifyLicenseResponse(BaseModel):
    """License verification response."""
    valid: bool
    status: str  # "valid", "invalid", "expired", "revoked"
    email: Optional[str] = None
    plan: Optional[str] = None
    expires_at: Optional[datetime] = None
    message: Optional[str] = None
