"""Database configuration."""
import logging
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import settings

logger = logging.getLogger(__name__)

# Check original DATABASE_URL before transformation to detect Fly.io internal network
_raw_db_url = os.environ.get("DATABASE_URL", "")
_is_fly_internal = ".internal:" in _raw_db_url or "fly.dev" in _raw_db_url or _raw_db_url.startswith("postgres://")

# For Fly.io production, internal network is already encrypted via WireGuard
# So we disable SSL at the PostgreSQL level
# asyncpg requires ssl=False in connect_args (sslmode URL param doesn't work)
logger.info(f"Database SSL disabled: {_is_fly_internal}")

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    connect_args={"ssl": False} if _is_fly_internal else {},
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncSession:
    """Get database session."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def migrate_enums(conn):
    """Add new enum values if they don't exist."""
    # Add 'free' to plantype enum if it doesn't exist
    try:
        await conn.execute(text("ALTER TYPE plantype ADD VALUE IF NOT EXISTS 'free'"))
        logger.info("Added 'free' value to plantype enum")
    except Exception as e:
        # Enum value might already exist
        logger.debug(f"plantype enum migration: {e}")


async def create_tables():
    """Create all tables."""
    async with engine.begin() as conn:
        # First migrate enums
        await migrate_enums(conn)
        # Then create tables
        await conn.run_sync(Base.metadata.create_all)
