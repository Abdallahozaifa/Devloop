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


class ThrottleInfo(BaseModel):
    """Throttle information returned with license verification."""
    allowed: bool
    runs_used: int
    runs_limit: int
    is_hard_limit: bool
    delay_seconds: int
    throttle_message: str


class VerifyLicenseResponse(BaseModel):
    """License verification response."""
    valid: bool
    status: str  # "valid", "invalid", "expired", "revoked"
    email: Optional[str] = None
    plan: Optional[str] = None
    expires_at: Optional[datetime] = None
    message: Optional[str] = None
    throttle: Optional[ThrottleInfo] = None


class RecordRunRequest(BaseModel):
    """Request to record a QA run for throttling."""
    license_key: str


class RecordRunResponse(BaseModel):
    """Response after recording a run."""
    success: bool
    runs_used: int
    runs_limit: int
    message: str
