from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
from redis.asyncio import Redis

from app.schema.db import get_db, get_redis
from app.schema.models import User, RefreshToken
from app.schema.schemas import AuthUser, LoginIn, RefreshIn, TokenPairOut
from app.helpers import new_id, create_access_token, make_refresh_token, hash_refresh_token, hash_password, verify_password
from app.conf import settings
from app.helpers_rate_limit import rate_limit_or_429

router = APIRouter(prefix="/auth", tags=["auth"])

def utcnow():
    return datetime.now(timezone.utc)

@router.post("/login", response_model=TokenPairOut)
async def login(
    body: LoginIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    ip = request.client.host if request.client else "unknown"

    # Rate limits
    await rate_limit_or_429(r, f"rl:auth:login:ip:{ip}", rate_per_sec=5/60, burst=10)
    await rate_limit_or_429(r, f"rl:auth:login:email:{body.email.lower()}", rate_per_sec=3/60, burst=6)

    q = select(User).where(User.email == body.email)
    user = (await db.execute(q)).scalars().first()

    # -------------------------
    # NEW USER REGISTRATION
    # -------------------------
    if not user:

        if not body.display_name_if_new:
            raise HTTPException(400, "New users must include display_name_if_new")

        if not body.password:
            raise HTTPException(400, "Password required for new users")

        user = User(
            id=new_id(),
            email=body.email,
            display_name=body.display_name_if_new,
            password_hash=hash_password(body.password),
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

    # -------------------------
    # EXISTING USER LOGIN
    # -------------------------
    else:

        if not user.password_hash:
            raise HTTPException(400, "Account does not support password login")

        if not verify_password(body.password, user.password_hash):
            raise HTTPException(401, "Invalid email or password")

    # -------------------------
    # TOKEN CREATION
    # -------------------------

    AuthUser(email=user.email, display_name=user.display_name)  # For type checking
    access = create_access_token(sub="user", user_id=str(user.id))

    refresh_raw = make_refresh_token()
    refresh_hash = hash_refresh_token(refresh_raw)

    rt = RefreshToken(
        id=new_id(),
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=utcnow() + timedelta(seconds=settings.REFRESH_TOKEN_TTL_SECONDS),
        user_agent=request.headers.get("user-agent"),
        ip_address=ip if ip != "unknown" else None,
    )

    db.add(rt)
    await db.commit()

    return TokenPairOut(access_token=access, refresh_token=refresh_raw)

@router.post("/refresh", response_model=TokenPairOut)
async def refresh(body: RefreshIn, request: Request, db: AsyncSession = Depends(get_db), r: Redis = Depends(get_redis)):
    ip = request.client.host if request.client else "unknown"
    await rate_limit_or_429(r, f"rl:auth:refresh:ip:{ip}", rate_per_sec=10/60, burst=20)

    token_hash = hash_refresh_token(body.refresh_token)

    q = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    rt = (await db.execute(q)).scalars().first()
    if not rt:
        raise HTTPException(401, "Invalid refresh token")

    now = utcnow()
    if rt.revoked_at is not None or rt.expires_at <= now:
        raise HTTPException(401, "Refresh token expired or revoked")

    # Rotate refresh token
    new_refresh_raw = make_refresh_token()
    new_rt = RefreshToken(
        id=new_id(),
        user_id=rt.user_id,
        token_hash=hash_refresh_token(new_refresh_raw),
        expires_at=now + timedelta(seconds=settings.REFRESH_TOKEN_TTL_SECONDS),
        user_agent=request.headers.get("user-agent"),
        ip_address=ip if ip != "unknown" else None,
    )
    db.add(new_rt)

    rt.revoked_at = now
    rt.replaced_by_id = new_rt.id

    await db.commit()

    access = create_access_token(sub="user", user_id=str(rt.user_id))
    return TokenPairOut(access_token=access, refresh_token=new_refresh_raw)

@router.post("/logout")
async def logout(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)

    q = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    rt = (await db.execute(q)).scalars().first()
    if not rt:
        raise HTTPException(401, "Invalid refresh token")

    rt.revoked_at = utcnow()
    await db.commit()

    return {"message": "Logged out successfully"}