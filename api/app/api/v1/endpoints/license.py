"""License endpoints for CLI activation."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.license import License
from app.models.subscription import Subscription
from app.schemas.license import (
    LicenseResponse,
    VerifyLicenseRequest,
    VerifyLicenseResponse,
    ThrottleInfo,
    RecordRunRequest,
    RecordRunResponse,
)
from app.services.license_service import LicenseService
from app.services.throttling_service import ThrottlingService

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

    # Build throttle info if present
    throttle_info = None
    if result.get("throttle"):
        t = result["throttle"]
        throttle_info = ThrottleInfo(
            allowed=t["allowed"],
            runs_used=t["runs_used"],
            runs_limit=t["runs_limit"],
            is_hard_limit=t["is_hard_limit"],
            delay_seconds=t["delay_seconds"],
            throttle_message=t["throttle_message"],
        )

    return VerifyLicenseResponse(
        valid=result["valid"],
        status=result["status"],
        email=result.get("email"),
        plan=result.get("plan"),
        expires_at=result.get("expires_at"),
        message=result.get("message"),
        throttle=throttle_info,
    )


@router.post("/record-run", response_model=RecordRunResponse)
async def record_run(
    request: RecordRunRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Record a QA run for throttling purposes. Called by CLI after each run."""
    # Find license and user
    result = await db.execute(
        select(License).where(License.key == request.license_key)
    )
    license = result.scalar_one_or_none()

    if not license:
        raise HTTPException(status_code=404, detail="License not found")

    # Get subscription for limits
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == license.user_id)
    )
    subscription = sub_result.scalar_one_or_none()

    # Record the run
    usage = await ThrottlingService.record_run(db, license.user_id)

    # Get daily limit
    daily_limit = subscription.daily_run_limit if subscription else 5

    return RecordRunResponse(
        success=True,
        runs_used=usage.runs_used,
        runs_limit=daily_limit,
        message=f"Run recorded. {usage.runs_used}/{daily_limit} runs used today.",
    )


@router.post("/generate", response_model=LicenseResponse)
async def generate_license(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Generate a new license key for current user."""
    license = await LicenseService.generate_license(db, current_user)
    return license
