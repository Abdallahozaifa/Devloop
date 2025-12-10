"""License endpoints for CLI activation."""
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.license import LicenseResponse, VerifyLicenseRequest, VerifyLicenseResponse
from app.services.license_service import LicenseService

router = APIRouter()


@router.get("/", response_model=list[LicenseResponse])
async def get_licenses(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get all licenses for current user."""
    licenses = await LicenseService.get_user_licenses(db, current_user)
    return licenses


@router.post("/verify", response_model=VerifyLicenseResponse)
async def verify_license(
    request: VerifyLicenseRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Verify a license key. Called by CLI on each run."""
    result = await LicenseService.verify_license(
        db,
        license_key=request.license_key,
        machine_id=request.machine_id,
    )

    return VerifyLicenseResponse(
        valid=result["valid"],
        status=result["status"],
        email=result.get("email"),
        plan=result.get("plan"),
        expires_at=result.get("expires_at"),
        message=result.get("message"),
    )


@router.post("/generate", response_model=LicenseResponse)
async def generate_license(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Generate a new license key for current user."""
    license = await LicenseService.generate_license(db, current_user)
    return license
