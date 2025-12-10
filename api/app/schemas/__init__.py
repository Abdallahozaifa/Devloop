"""Pydantic schemas."""
from app.schemas.auth import (
    MagicLinkRequest,
    MagicLinkVerify,
    TokenResponse,
    UserResponse,
)
from app.schemas.billing import (
    CreateCheckoutRequest,
    CreateCheckoutResponse,
    SubscriptionResponse,
)
from app.schemas.license import (
    LicenseResponse,
    VerifyLicenseRequest,
    VerifyLicenseResponse,
)

__all__ = [
    "MagicLinkRequest",
    "MagicLinkVerify",
    "TokenResponse",
    "UserResponse",
    "CreateCheckoutRequest",
    "CreateCheckoutResponse",
    "SubscriptionResponse",
    "LicenseResponse",
    "VerifyLicenseRequest",
    "VerifyLicenseResponse",
]
