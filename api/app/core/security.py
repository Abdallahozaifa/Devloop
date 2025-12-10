"""Security utilities for authentication and license keys."""
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return None


def create_magic_link_token(email: str) -> str:
    """Create a magic link token."""
    expire = datetime.utcnow() + timedelta(minutes=settings.MAGIC_LINK_EXPIRE_MINUTES)
    data = {"email": email, "exp": expire, "type": "magic_link"}
    return jwt.encode(data, settings.SECRET_KEY, algorithm="HS256")


def verify_magic_link_token(token: str) -> Optional[str]:
    """Verify a magic link token and return email."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "magic_link":
            return None
        return payload.get("email")
    except JWTError:
        return None


def generate_license_key() -> str:
    """Generate a unique license key: DL-XXXX-XXXX-XXXX."""
    parts = [secrets.token_hex(2).upper() for _ in range(3)]
    return f"DL-{parts[0]}-{parts[1]}-{parts[2]}"


def sign_license_key(license_key: str, email: str) -> str:
    """Sign a license key with the email for verification."""
    message = f"{license_key}:{email}"
    signature = hmac.new(
        settings.LICENSE_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()[:16]
    return signature


def verify_license_signature(license_key: str, email: str, signature: str) -> bool:
    """Verify a license key signature."""
    expected_signature = sign_license_key(license_key, email)
    return hmac.compare_digest(expected_signature, signature)
