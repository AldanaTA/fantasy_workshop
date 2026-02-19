from uuid import UUID
from datetime import datetime, timedelta, timezone
import hashlib, hmac, secrets
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from conf import settings

from uuid7 import uuid7

bearer = HTTPBearer(auto_error=False)

def new_id() -> UUID:
    return uuid7()

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

def hash_refresh_token(raw: str) -> str:
    # HMAC prevents rainbow-table style reuse if your DB is leaked.
    return hmac.new(settings.JWT_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()

def create_access_token(*, sub: str, user_id: str) -> str:
    now = _utcnow()
    payload = {
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.ACCESS_TOKEN_TTL_SECONDS)).timestamp()),
        "sub": sub,
        "uid": user_id,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)

def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALG],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

async def require_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Missing Authorization: Bearer token")
    return decode_access_token(creds.credentials)

def make_refresh_token() -> str:
    # opaque token (not a JWT) — rotateable, revocable, and stored hashed in DB
    return secrets.token_urlsafe(48)
