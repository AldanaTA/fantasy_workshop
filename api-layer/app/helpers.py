from uuid import UUID
from datetime import datetime, timedelta, timezone
import hashlib, hmac, secrets, json
import jwt
from fastapi import Depends, HTTPException, Query, Response, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from uuid_extensions import uuid7
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.conf import settings

bearer = HTTPBearer(auto_error=False)

ph = PasswordHasher()

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return ph.verify(stored_hash, password)
    except VerifyMismatchError:
        return False
    
def new_id() -> UUID:
    return uuid7()

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

def hash_refresh_token(raw: str) -> str:
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

async def require_user_ws(token: str = Query(...)) -> dict:
    # WebSocket: connect with ?token=<ACCESS_JWT>
    return decode_access_token(token)

def make_refresh_token() -> str:
    # Opaque, revocable, rotateable; stored hashed in DB
    return secrets.token_urlsafe(48)

# JSON helpers for redis caching
def json_dumps(obj) -> str:
    return json.dumps(obj, separators=(",", ":"), default=str)

def json_loads(s: str):
    return json.loads(s)

### REFRESH TOKEN HELPERS ###
REFRESH_COOKIE_NAME = "refresh_token"

'''
Sets Refresh Token cookie in the response. 
The cookie is HTTP only, secure, and has a max age defined by settings. 
It is set for the /auth path.
'''
def set_refresh_cookie(response: Response, refresh_token: str):
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_TTL_SECONDS,
        path="/auth",
    )

'''
Clears the Refresh Token cookie from the response.
'''
def clear_refresh_cookie(response: Response):
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/auth",
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )

'''
Retrieves the Refresh Token from the request cookies.
Raises an HTTPException if the token is missing.'''
def get_refresh_cookie(request: Request) -> str:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail="Refresh token missing",
        )

    return refresh_token

def get_refresh_cookie_name() -> str:
    return REFRESH_COOKIE_NAME