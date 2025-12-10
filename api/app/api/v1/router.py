"""API v1 router."""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, billing, license, dashboard

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(license.router, prefix="/license", tags=["license"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
