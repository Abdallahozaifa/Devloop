"""License service for generating and validating license keys."""
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_license_key, sign_license_key
from app.models.user import User
from app.models.license import License, LicenseStatus
from app.models.subscription import Subscription

logger = logging.getLogger(__name__)


class LicenseService:
    """Service for license operations."""

    @staticmethod
    async def generate_license(db: AsyncSession, user: User) -> License:
        """Generate a new license key for a user."""
        # Check if user already has an active license
        result = await db.execute(
            select(License).where(
                License.user_id == user.id,
                License.status == LicenseStatus.ACTIVE
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"User {user.id} already has active license: {existing.key}")
            return existing

        # Generate new license
        key = generate_license_key()
        signature = sign_license_key(key, user.email)

        license = License(
            user_id=user.id,
            key=key,
            signature=signature,
            status=LicenseStatus.ACTIVE,
        )
        db.add(license)
        await db.commit()
        await db.refresh(license)

        logger.info(f"Generated new license for user {user.id}: {key}")
        return license

    @staticmethod
    async def verify_license(
        db: AsyncSession,
        license_key: str,
        machine_id: Optional[str] = None,
    ) -> dict:
        """Verify a license key and return status."""
        # Find license
        result = await db.execute(
            select(License).where(License.key == license_key)
        )
        license = result.scalar_one_or_none()

        if not license:
            return {
                "valid": False,
                "status": "invalid",
                "message": "License key not found",
            }

        # Get user and subscription
        user_result = await db.execute(
            select(User).where(User.id == license.user_id)
        )
        user = user_result.scalar_one_or_none()

        sub_result = await db.execute(
            select(Subscription).where(Subscription.user_id == license.user_id)
        )
        subscription = sub_result.scalar_one_or_none()

        # Check license status
        if license.status == LicenseStatus.REVOKED:
            return {
                "valid": False,
                "status": "revoked",
                "message": "License has been revoked",
            }

        if license.status == LicenseStatus.EXPIRED:
            return {
                "valid": False,
                "status": "expired",
                "message": "License has expired",
            }

        # Check if subscription is active
        if subscription and not subscription.is_active:
            # Grace period check (7 days after cancel)
            if subscription.current_period_end:
                from datetime import timedelta
                grace_end = subscription.current_period_end + timedelta(days=7)
                if datetime.utcnow() > grace_end:
                    # Revoke license
                    license.status = LicenseStatus.REVOKED
                    license.revoked_at = datetime.utcnow()
                    await db.commit()
                    return {
                        "valid": False,
                        "status": "revoked",
                        "message": "Subscription has ended and grace period expired",
                    }

        # Check expiry
        if license.expires_at and datetime.utcnow() > license.expires_at:
            license.status = LicenseStatus.EXPIRED
            await db.commit()
            return {
                "valid": False,
                "status": "expired",
                "message": "License has expired",
            }

        # Update last verified
        license.last_verified_at = datetime.utcnow()
        if machine_id:
            license.machine_id = machine_id
        await db.commit()

        return {
            "valid": True,
            "status": "valid",
            "email": user.email if user else None,
            "plan": subscription.plan.value if subscription else None,
            "expires_at": subscription.current_period_end if subscription else None,
            "message": "License is valid",
        }

    @staticmethod
    async def revoke_license(db: AsyncSession, license_key: str) -> bool:
        """Revoke a license key."""
        result = await db.execute(
            select(License).where(License.key == license_key)
        )
        license = result.scalar_one_or_none()

        if not license:
            return False

        license.status = LicenseStatus.REVOKED
        license.revoked_at = datetime.utcnow()
        await db.commit()

        logger.info(f"Revoked license: {license_key}")
        return True

    @staticmethod
    async def get_user_licenses(db: AsyncSession, user: User) -> list[License]:
        """Get all licenses for a user."""
        result = await db.execute(
            select(License)
            .where(License.user_id == user.id)
            .order_by(License.created_at.desc())
        )
        return list(result.scalars().all())
