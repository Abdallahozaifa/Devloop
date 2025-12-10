"""Application configuration."""
import json
import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # App
    APP_NAME: str = "DevLoop"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/devloop"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """Convert postgres:// to postgresql+asyncpg:// for SQLAlchemy."""
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Store sslmode for later use, but remove from URL
        # asyncpg handles SSL via connect_args, not URL params
        if "?sslmode=" in v:
            v = v.split("?sslmode=")[0]
        elif "&sslmode=" in v:
            v = v.split("&sslmode=")[0]
        return v

    # Security
    SECRET_KEY: str = "change-me-in-production"
    LICENSE_SECRET: str = "change-me-license-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    MAGIC_LINK_EXPIRE_MINUTES: int = 15

    # CORS - in production, set CORS_ORIGINS="https://devloop-landing.fly.dev,https://devloop.dev"
    # Using str to avoid pydantic-settings JSON parsing issues
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,https://devloop-landing.fly.dev,https://devloop.dev"

    def get_cors_origins(self) -> List[str]:
        """Get CORS origins as a list."""
        v = self.CORS_ORIGINS
        # Try to parse as JSON first (for ["url1","url2"] format)
        if v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
        # Otherwise, parse as comma-separated string
        return [origin.strip() for origin in v.split(",") if origin.strip()]

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_SOLO_PRICE_ID: str = ""
    STRIPE_PRO_PRICE_ID: str = ""
    STRIPE_TEAM_PRICE_ID: str = ""

    # Email (for magic links)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@devloop.dev"
    SMTP_FROM_NAME: str = "DevLoop"

    # URLs
    FRONTEND_URL: str = "http://localhost:5173"
    API_URL: str = "http://localhost:8000"

    class Config:
        env_file = ".env"
        case_sensitive = True


def get_settings() -> Settings:
    """Get settings instance."""
    return Settings()


# Create settings instance once at module load
settings = get_settings()
